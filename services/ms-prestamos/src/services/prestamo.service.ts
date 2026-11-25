import { randomUUID } from 'node:crypto';
import { AppError, EstadoCliente, EstadoCuenta, EstadoPrestamo, type Identity, RolCliente } from '@chuno/shared';
import { clientesClient } from '../clients/clientes.client';
import { cuentasClient } from '../clients/cuentas.client';
import type { Prestamo } from '../entities/prestamo.entity';
import { prestamoRepository } from '../repositories/prestamo.repository';
import type { ActualizarPrestamoDto, CrearPrestamoDto, SimularDto } from '../schemas/prestamo.schema';
import { calcularPlan, type PlanPrestamo } from './amortizacion';

function exigirIdentidad(identity: Identity): { userId: string; rol: RolCliente } {
  if (!identity.userId || !identity.rol) throw AppError.unauthorized('Falta la identidad del usuario');
  return { userId: identity.userId, rol: identity.rol };
}

function esAdmin(identity: Identity): boolean {
  return identity.rol === RolCliente.ADMIN;
}

async function obtenerPropio(identity: Identity, id: string): Promise<Prestamo> {
  const prestamo = await prestamoRepository.buscarPorId(id);
  if (!prestamo) throw AppError.notFound('Préstamo no encontrado');
  if (!esAdmin(identity) && prestamo.clienteId !== identity.userId) {
    throw AppError.forbidden('No puede acceder a préstamos de otro cliente');
  }
  return prestamo;
}

function exigirSolicitado(prestamo: Prestamo, accion: string): void {
  if (prestamo.estado !== EstadoPrestamo.SOLICITADO) {
    throw AppError.businessRule(`Solo se puede ${accion} un préstamo SOLICITADO`, {
      estadoActual: prestamo.estado,
    });
  }
}

/** La cuenta debe existir, estar activa y pertenecer al cliente del préstamo. */
async function validarCuentaDesembolso(cuentaId: string, clienteId: string | undefined) {
  const cuenta = await cuentasClient.obtener(cuentaId);
  if (clienteId && cuenta.clienteId !== clienteId) {
    throw AppError.businessRule('La cuenta de desembolso no pertenece al cliente', { motivo: 'CUENTA_AJENA' });
  }
  if (cuenta.estado !== EstadoCuenta.ACTIVA) {
    throw AppError.businessRule('La cuenta de desembolso no está activa', { motivo: 'CUENTA_CERRADA' });
  }
  return cuenta;
}

async function validarClienteActivo(clienteId: string): Promise<void> {
  const cliente = await clientesClient.obtener(clienteId);
  if (cliente.estado !== EstadoCliente.ACTIVO) {
    throw AppError.businessRule('El cliente no está activo', { motivo: 'CLIENTE_INACTIVO' });
  }
}

function cuotasDelPlan(plan: PlanPrestamo) {
  return plan.cuotas.map(({ numero, fechaVencimiento, capital, interes, cuota, saldo }) => ({
    numero,
    fechaVencimiento,
    capital,
    interes,
    cuota,
    saldo,
  }));
}

export const prestamoService = {
  simular(dto: SimularDto): PlanPrestamo {
    return calcularPlan(dto.monto, dto.tasaAnual, dto.plazoMeses);
  },

  async crear(identity: Identity, dto: CrearPrestamoDto): Promise<Prestamo> {
    const { userId } = exigirIdentidad(identity);

    // El CLIENTE solicita para sí mismo; el ADMIN puede indicar el cliente o tomarlo de la cuenta.
    let clienteId = esAdmin(identity) ? dto.clienteId : userId;
    const cuenta = await validarCuentaDesembolso(dto.cuentaDesembolsoId, clienteId);
    clienteId ??= cuenta.clienteId;
    await validarClienteActivo(clienteId);

    const plan = calcularPlan(dto.monto, dto.tasaAnual, dto.plazoMeses);
    const creado = await prestamoRepository.crearConCuotas(
      {
        clienteId,
        cuentaDesembolsoId: cuenta.id,
        cuentaDesembolsoNumero: cuenta.numero,
        monto: dto.monto,
        tasaAnual: dto.tasaAnual,
        plazoMeses: dto.plazoMeses,
        cuotaMensual: plan.cuotaMensual,
        estado: EstadoPrestamo.SOLICITADO,
        referenciaDesembolso: null,
      },
      cuotasDelPlan(plan),
    );
    return this.obtener(identity, creado.id);
  },

  async listar(identity: Identity, clienteIdFiltro?: string): Promise<Prestamo[]> {
    const { userId } = exigirIdentidad(identity);
    return prestamoRepository.listar(esAdmin(identity) ? clienteIdFiltro : userId);
  },

  async obtener(identity: Identity, id: string): Promise<Prestamo> {
    exigirIdentidad(identity);
    await obtenerPropio(identity, id);
    const prestamo = await prestamoRepository.buscarConCuotas(id);
    if (!prestamo) throw AppError.notFound('Préstamo no encontrado');
    return prestamo;
  },

  async actualizar(identity: Identity, id: string, dto: ActualizarPrestamoDto): Promise<Prestamo> {
    exigirIdentidad(identity);
    const prestamo = await obtenerPropio(identity, id);
    exigirSolicitado(prestamo, 'modificar');

    const cambios: Partial<Prestamo> = {};
    if (dto.cuentaDesembolsoId && dto.cuentaDesembolsoId !== prestamo.cuentaDesembolsoId) {
      const cuenta = await validarCuentaDesembolso(dto.cuentaDesembolsoId, prestamo.clienteId);
      cambios.cuentaDesembolsoId = cuenta.id;
      cambios.cuentaDesembolsoNumero = cuenta.numero;
    }

    const monto = dto.monto ?? prestamo.monto;
    const tasaAnual = dto.tasaAnual ?? prestamo.tasaAnual;
    const plazoMeses = dto.plazoMeses ?? prestamo.plazoMeses;
    const plan = calcularPlan(monto, tasaAnual, plazoMeses);

    await prestamoRepository.actualizarConCuotas(
      id,
      { ...cambios, monto, tasaAnual, plazoMeses, cuotaMensual: plan.cuotaMensual },
      cuotasDelPlan(plan),
    );
    return this.obtener(identity, id);
  },

  /**
   * Aprobar (solo ADMIN): acredita el monto en la cuenta con origen DESEMBOLSO y pasa a APROBADO.
   * La referencia se guarda antes de acreditar: si el crédito falla y se reintenta,
   * ms-cuentas reconoce la misma referencia y no desembolsa dos veces.
   */
  async aprobar(identity: Identity, id: string): Promise<Prestamo> {
    exigirIdentidad(identity);
    const prestamo = await obtenerPropio(identity, id);
    exigirSolicitado(prestamo, 'aprobar');

    await validarCuentaDesembolso(prestamo.cuentaDesembolsoId, prestamo.clienteId);

    const referencia = prestamo.referenciaDesembolso ?? randomUUID();
    if (!prestamo.referenciaDesembolso) {
      await prestamoRepository.actualizar(id, { referenciaDesembolso: referencia });
    }

    await cuentasClient.acreditarDesembolso(
      prestamo.cuentaDesembolsoId,
      prestamo.monto,
      referencia,
      `Desembolso préstamo ${prestamo.id.slice(0, 8)}`,
    );

    await prestamoRepository.actualizar(id, { estado: EstadoPrestamo.APROBADO });
    return this.obtener(identity, id);
  },

  async rechazar(identity: Identity, id: string): Promise<Prestamo> {
    exigirIdentidad(identity);
    const prestamo = await obtenerPropio(identity, id);
    exigirSolicitado(prestamo, 'rechazar');
    await prestamoRepository.actualizar(id, { estado: EstadoPrestamo.RECHAZADO });
    return this.obtener(identity, id);
  },

  /** Cancelar: solo si está SOLICITADO. Un préstamo nunca se borra físicamente. */
  async cancelar(identity: Identity, id: string): Promise<Prestamo> {
    exigirIdentidad(identity);
    const prestamo = await obtenerPropio(identity, id);
    exigirSolicitado(prestamo, 'cancelar');
    await prestamoRepository.actualizar(id, { estado: EstadoPrestamo.CANCELADO });
    return this.obtener(identity, id);
  },
};
