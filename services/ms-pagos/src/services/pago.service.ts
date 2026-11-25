import { randomUUID } from 'node:crypto';
import { AppError, EstadoCuenta, EstadoPago, OrigenMovimiento, RolCliente, createLogger } from '@chuno/shared';
import { CuentasClient } from '../clients/cuentas.client';
import { ExternosClient } from '../clients/externos.client';
import type { EmpresaEntity } from '../entities/empresa.entity';
import type { PagoEntity } from '../entities/pago.entity';
import { EmpresaRepository } from '../repositories/empresa.repository';
import { PagoRepository } from '../repositories/pago.repository';
import type { CrearPagoDto } from '../schemas/pago.schema';

export interface ActorIdentidad {
  userId: string;
  rol: RolCliente;
}

export interface ConsultaDeudaResultado {
  empresa: {
    id: string;
    codigo: string;
    nombre: string;
    tipo: string;
  };
  codigoCliente: string;
  titular: string;
  periodo: string;
  monto: number;
}

function truncateMotivo(text: string): string {
  return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}

function toDetailsObject(details: unknown): Record<string, unknown> {
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }
  return {};
}

export class PagoService {
  private readonly logger = createLogger('ms-pagos:PagoService');

  constructor(
    private readonly empresaRepo = new EmpresaRepository(),
    private readonly pagoRepo = new PagoRepository(),
    private readonly cuentasClient = new CuentasClient(),
    private readonly externosClient = new ExternosClient(),
  ) {}

  async listarEmpresas(): Promise<EmpresaEntity[]> {
    return this.empresaRepo.findActivas();
  }

  async consultarDeuda(empresaCodigo: string, codigoCliente: string): Promise<ConsultaDeudaResultado> {
    const empresa = await this.empresaRepo.findByCodigo(empresaCodigo);
    if (!empresa) {
      throw AppError.notFound(`Empresa de servicio '${empresaCodigo.toUpperCase()}' no encontrada`);
    }

    const deuda = await this.externosClient.consultarDeuda(empresa.codigo, codigoCliente);
    return {
      empresa: {
        id: empresa.id,
        codigo: empresa.codigo,
        nombre: empresa.nombre,
        tipo: empresa.tipo,
      },
      ...deuda,
    };
  }

  async pagar(actor: ActorIdentidad, dto: CrearPagoDto): Promise<PagoEntity> {
    const cuenta = await this.cuentasClient.obtenerCuenta(dto.cuentaId);

    if (actor.rol !== RolCliente.ADMIN && cuenta.clienteId !== actor.userId) {
      throw AppError.forbidden('No puede pagar servicios desde una cuenta que no le pertenece');
    }

    if (cuenta.estado !== EstadoCuenta.ACTIVA) {
      throw AppError.businessRule('La cuenta seleccionada no está activa para operar');
    }

    const empresa = await this.empresaRepo.findByCodigo(dto.empresaCodigo);
    if (!empresa) {
      throw AppError.notFound(`Empresa de servicio '${dto.empresaCodigo.toUpperCase()}' no encontrada`);
    }

    const deuda = await this.externosClient.consultarDeuda(empresa.codigo, dto.codigoClienteServicio);

    if (deuda.monto <= 0) {
      throw AppError.businessRule('El monto de deuda debe ser mayor a cero');
    }

    const referencia = randomUUID();
    const pagoPendiente = await this.pagoRepo.create({
      referencia,
      clienteId: cuenta.clienteId,
      cuentaId: cuenta.id,
      empresaId: empresa.id,
      codigoClienteServicio: deuda.codigoCliente,
      periodo: deuda.periodo,
      monto: deuda.monto,
      estado: EstadoPago.PENDIENTE,
    });

    try {
      await this.cuentasClient.debitar(cuenta.id, {
        monto: deuda.monto,
        referencia,
        origen: OrigenMovimiento.PAGO_SERVICIO,
        glosa: `Pago ${empresa.nombre} (${deuda.codigoCliente})`.slice(0, 150),
      });
    } catch (error) {
      const motivo = truncateMotivo(error instanceof Error ? error.message : 'No se pudo debitar la cuenta');
      const pagoRechazado = await this.pagoRepo.updateEstado(pagoPendiente.id, EstadoPago.RECHAZADO, {
        motivo,
      });

      if (error instanceof AppError) {
        throw new AppError(error.code, error.message, error.statusCode, {
          ...toDetailsObject(error.details),
          pago: pagoRechazado,
        });
      }

      throw AppError.serviceUnavailable('No se pudo procesar el débito de la cuenta', {
        pago: pagoRechazado,
      });
    }

    try {
      const confirmacion = await this.externosClient.confirmarPago(empresa.codigo, {
        codigoCliente: deuda.codigoCliente,
        monto: deuda.monto,
        referencia,
      });

      return await this.pagoRepo.updateEstado(pagoPendiente.id, EstadoPago.COMPLETADO, {
        comprobante: confirmacion.comprobante,
        motivo: null,
      });
    } catch (error) {
      const fallaProveedor = error instanceof Error ? error.message : 'El proveedor no confirmó el pago';
      this.logger.warn('pago.externo_fallo_iniciando_reversion', {
        pagoId: pagoPendiente.id,
        referencia,
        empresa: empresa.codigo,
        error: fallaProveedor,
      });

      try {
        await this.cuentasClient.acreditar(cuenta.id, {
          monto: deuda.monto,
          referencia,
          origen: OrigenMovimiento.REVERSION,
          glosa: `Reversión pago ${empresa.nombre} (${deuda.codigoCliente})`.slice(0, 150),
        });
      } catch (reversionError) {
        this.logger.error('pago.reversion_fallida', {
          pagoId: pagoPendiente.id,
          referencia,
          error: reversionError instanceof Error ? reversionError.message : String(reversionError),
        });
        const pagoConErrorReversion = await this.pagoRepo.updateEstado(pagoPendiente.id, EstadoPago.PENDIENTE, {
          motivo: truncateMotivo(
            `Proveedor falló (${fallaProveedor}) y la reversión automática falló; requiere conciliación`,
          ),
        });
        throw AppError.serviceUnavailable('El proveedor falló y no se pudo completar la reversión automática', {
          pago: pagoConErrorReversion,
          revertido: false,
        });
      }

      const motivoReversion = truncateMotivo(
        `Proveedor externo rechazó o falló (${fallaProveedor}); monto revertido a su cuenta`,
      );
      const pagoRevertido = await this.pagoRepo.updateEstado(pagoPendiente.id, EstadoPago.REVERTIDO, {
        motivo: motivoReversion,
      });

      throw AppError.serviceUnavailable(
        'El proveedor externo no pudo confirmar el pago; el débito fue revertido automáticamente',
        { pago: pagoRevertido, revertido: true },
      );
    }
  }

  async listarPagos(actor: ActorIdentidad, clienteIdFilter?: string): Promise<PagoEntity[]> {
    if (actor.rol === RolCliente.ADMIN) {
      return clienteIdFilter ? this.pagoRepo.findByClienteId(clienteIdFilter) : this.pagoRepo.findAll();
    }

    if (clienteIdFilter && clienteIdFilter !== actor.userId) {
      throw AppError.forbidden('No puede consultar el historial de pagos de otro cliente');
    }

    return this.pagoRepo.findByClienteId(actor.userId);
  }

  async obtenerPago(actor: ActorIdentidad, id: string): Promise<PagoEntity> {
    const pago = await this.pagoRepo.findById(id);
    if (!pago) {
      throw AppError.notFound('Pago no encontrado');
    }

    if (actor.rol !== RolCliente.ADMIN && pago.clienteId !== actor.userId) {
      throw AppError.forbidden('No tiene permiso para ver este pago');
    }

    return pago;
  }
}
