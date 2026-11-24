import { randomUUID } from 'node:crypto';
import {
  AppError,
  EstadoCuenta,
  EstadoTransferencia,
  OrigenMovimiento,
  RolCliente,
  TipoTransferencia,
  createLogger,
} from '@chuno/shared';
import type { CuentaInterna, Identity } from '@chuno/shared';
import { CuentasClient } from '../clients/cuentas.client';
import { ExternosClient } from '../clients/externos.client';
import type { Banco } from '../clients/externos.client';
import type { Transferencia } from '../entities/transferencia.entity';
import { transferenciaRepository } from '../repositories/transferencia.repository';
import type { TransferenciaRepository } from '../repositories/transferencia.repository';
import { BANCO_INTERNO, MONTO_MAXIMO } from '../schemas/transferencia.schema';
import type { CrearTransferenciaDto, ListarTransferenciasQuery } from '../schemas/transferencia.schema';

const logger = createLogger('ms-transferencias');

const INTENTOS_COMPENSACION = 3;
const GLOSA_POR_DEFECTO: Record<TipoTransferencia, string> = {
  [TipoTransferencia.PROPIA]: 'Transferencia entre cuentas propias',
  [TipoTransferencia.TERCERO]: 'Transferencia a tercero',
  [TipoTransferencia.INTERBANCARIA]: 'Transferencia interbancaria',
};

export interface ResultadoTransferencia {
  transferencia: Transferencia;
  /** true si la referencia ya existía y se devolvió el resultado anterior. */
  repetida: boolean;
}

interface DatosBase {
  referencia: string;
  clienteId: string;
  tipo: TipoTransferencia;
  cuentaOrigenId: string;
  monto: number;
  glosa: string;
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function esSaldoInsuficiente(error: unknown): boolean {
  return (
    error instanceof AppError &&
    error.code === 'BUSINESS_RULE' &&
    esRegistro(error.details) &&
    error.details.motivo === 'SALDO_INSUFICIENTE'
  );
}

function normalizarBancos(data: unknown): Banco[] {
  const lista = Array.isArray(data) ? data : esRegistro(data) && Array.isArray(data.bancos) ? data.bancos : [];
  const bancos: Banco[] = [];
  for (const item of lista) {
    if (typeof item === 'string' && item.trim()) {
      bancos.push({ codigo: item, nombre: item });
    } else if (esRegistro(item)) {
      const codigo = String(item.codigo ?? item.id ?? item.nombre ?? item.name ?? '').trim();
      if (!codigo) continue;
      bancos.push({ codigo, nombre: String(item.nombre ?? item.name ?? codigo) });
    }
  }
  return bancos;
}

const redondear = (valor: number): number => Math.round(valor * 100) / 100;

export class TransferenciaService {
  constructor(
    private readonly repo: Pick<TransferenciaRepository, 'findByReferencia' | 'crear' | 'findByCliente' | 'findAll'> =
      transferenciaRepository,
    private readonly cuentas: CuentasClient = new CuentasClient(),
    private readonly externos: ExternosClient = new ExternosClient(),
  ) {}

  async crear(identity: Identity, dto: CrearTransferenciaDto): Promise<ResultadoTransferencia> {
    const clienteId = identity.userId;
    if (!clienteId) throw AppError.unauthorized('Falta la identidad del usuario');

    const monto = redondear(dto.monto);
    if (monto <= 0 || monto > MONTO_MAXIMO) {
      throw AppError.businessRule('El monto debe ser mayor a 0 y como máximo Bs 50.000', { motivo: 'MONTO_FUERA_DE_LIMITE' });
    }

    // Idempotencia: la misma referencia devuelve el resultado anterior y no vuelve a mover dinero.
    const referencia = dto.referencia ?? randomUUID();
    const previa = await this.repo.findByReferencia(referencia);
    if (previa) {
      if (previa.clienteId !== clienteId) throw AppError.conflict('La referencia ya fue utilizada');
      return { transferencia: previa, repetida: true };
    }

    const origen = await this.obtenerCuentaOrigen(dto.cuentaOrigenId, clienteId);
    const base: DatosBase = {
      referencia,
      clienteId,
      tipo: dto.tipo,
      cuentaOrigenId: origen.id,
      monto,
      glosa: dto.glosa || GLOSA_POR_DEFECTO[dto.tipo],
    };

    const transferencia =
      dto.tipo === TipoTransferencia.INTERBANCARIA
        ? await this.transferirInterbancaria(base, origen, dto)
        : await this.transferirInterna(base, origen, dto.cuentaDestinoNumero);

    return { transferencia, repetida: false };
  }

  async listar(identity: Identity, query: ListarTransferenciasQuery): Promise<Transferencia[]> {
    if (identity.rol === RolCliente.ADMIN) return this.repo.findAll(query.limit, query.clienteId);
    if (identity.rol === RolCliente.CLIENTE && identity.userId) return this.repo.findByCliente(identity.userId, query.limit);
    throw AppError.forbidden();
  }

  async listarBancos(): Promise<Banco[]> {
    return normalizarBancos(await this.externos.listarBancos());
  }

  // ---------------------------------------------------------------- HU-09

  private async transferirInterna(base: DatosBase, origen: CuentaInterna, numeroDestino: string): Promise<Transferencia> {
    const destino = await this.obtenerCuentaDestino(numeroDestino);

    if (destino.id === origen.id) {
      throw AppError.businessRule('La cuenta de origen y la de destino deben ser distintas', { motivo: 'MISMA_CUENTA' });
    }
    if (destino.estado !== EstadoCuenta.ACTIVA) {
      throw AppError.businessRule('La cuenta de destino está cerrada', { motivo: 'CUENTA_DESTINO_CERRADA' });
    }
    const mismoCliente = destino.clienteId === origen.clienteId;
    if (base.tipo === TipoTransferencia.PROPIA && !mismoCliente) {
      throw AppError.businessRule('Una transferencia propia exige que el destino sea una cuenta suya', { motivo: 'DESTINO_AJENO' });
    }
    if (base.tipo === TipoTransferencia.TERCERO && mismoCliente) {
      throw AppError.businessRule('Una transferencia a terceros exige que el destino sea de otro cliente', {
        motivo: 'DESTINO_PROPIO',
      });
    }

    const registro = {
      ...base,
      cuentaDestinoId: destino.id,
      cuentaDestinoNumero: destino.numero,
      bancoDestino: BANCO_INTERNO,
      titularDestino: null,
      codigoExterno: null,
    };

    try {
      await this.cuentas.transferir({
        cuentaOrigenId: origen.id,
        cuentaDestinoId: destino.id,
        monto: base.monto,
        referencia: base.referencia,
        glosa: base.glosa,
      });
    } catch (error) {
      if (esSaldoInsuficiente(error)) {
        return this.repo.crear({ ...registro, estado: EstadoTransferencia.RECHAZADA, motivo: 'Saldo insuficiente' });
      }
      throw error;
    }

    return this.repo.crear({ ...registro, estado: EstadoTransferencia.COMPLETADA, motivo: null });
  }

  // ---------------------------------------------------------------- HU-10

  private async transferirInterbancaria(
    base: DatosBase,
    origen: CuentaInterna,
    dto: Extract<CrearTransferenciaDto, { tipo: TipoTransferencia.INTERBANCARIA }>,
  ): Promise<Transferencia> {
    const registro = {
      ...base,
      cuentaDestinoId: null,
      cuentaDestinoNumero: dto.cuentaDestinoNumero,
      bancoDestino: dto.bancoDestino,
      titularDestino: dto.titularDestino,
    };

    // 1. Débito en la cuenta de origen. Sin saldo: se rechaza y NO se llama al intermediario.
    try {
      await this.cuentas.debitar(origen.id, {
        monto: base.monto,
        referencia: base.referencia,
        origen: OrigenMovimiento.TRANSFERENCIA,
        glosa: base.glosa,
      });
    } catch (error) {
      if (esSaldoInsuficiente(error)) {
        return this.repo.crear({
          ...registro,
          estado: EstadoTransferencia.RECHAZADA,
          codigoExterno: null,
          motivo: 'Saldo insuficiente',
        });
      }
      throw error;
    }

    // 2. Orden al intermediario interbancario.
    let motivoFallo: string;
    try {
      const respuesta = await this.externos.enviarOrden({
        bancoDestino: dto.bancoDestino,
        cuentaDestino: dto.cuentaDestinoNumero,
        titular: dto.titularDestino,
        monto: base.monto,
        referencia: base.referencia,
      });
      if (respuesta?.estado === 'ACEPTADA' && respuesta.codigoAch) {
        return this.repo.crear({
          ...registro,
          estado: EstadoTransferencia.COMPLETADA,
          codigoExterno: respuesta.codigoAch.slice(0, 40),
          motivo: null,
        });
      }
      motivoFallo = 'El intermediario interbancario rechazó la transferencia';
    } catch (error) {
      motivoFallo =
        error instanceof AppError && error.status === 422
          ? 'El intermediario interbancario rechazó la transferencia'
          : 'El intermediario interbancario no respondió';
    }

    // 3. Compensación: el externo falló después de debitar, se devuelve el dinero.
    await this.devolverDinero(base, origen.id);
    return this.repo.crear({
      ...registro,
      estado: EstadoTransferencia.REVERTIDA,
      codigoExterno: null,
      motivo: motivoFallo,
    });
  }

  /** Acredita de vuelta con la misma referencia (idempotente en ms-cuentas) y origen REVERSION. */
  private async devolverDinero(base: DatosBase, cuentaOrigenId: string): Promise<void> {
    for (let intento = 1; intento <= INTENTOS_COMPENSACION; intento += 1) {
      try {
        await this.cuentas.acreditar(cuentaOrigenId, {
          monto: base.monto,
          referencia: base.referencia,
          origen: OrigenMovimiento.REVERSION,
          glosa: `Reversión: ${base.glosa}`.slice(0, 150),
        });
        return;
      } catch {
        logger.warn('transferencia.compensacion_reintento', { referencia: base.referencia, intento });
        if (intento < INTENTOS_COMPENSACION) await new Promise((resolve) => setTimeout(resolve, 200 * intento));
      }
    }
    logger.error('transferencia.compensacion_fallida', { referencia: base.referencia });
    throw AppError.serviceUnavailable(
      'No se pudo devolver el dinero a la cuenta de origen. Reintente con la misma referencia',
      { referencia: base.referencia },
    );
  }

  // ---------------------------------------------------------------- Cuentas

  private async obtenerCuentaOrigen(cuentaId: string, clienteId: string): Promise<CuentaInterna> {
    let cuenta: CuentaInterna;
    try {
      cuenta = await this.cuentas.obtenerPorId(cuentaId);
    } catch (error) {
      if (error instanceof AppError && error.code === 'NOT_FOUND') throw AppError.notFound('La cuenta de origen no existe');
      throw error;
    }
    if (cuenta.clienteId !== clienteId) throw AppError.forbidden('La cuenta de origen no pertenece al cliente');
    if (cuenta.estado !== EstadoCuenta.ACTIVA) {
      throw AppError.businessRule('La cuenta de origen está cerrada', { motivo: 'CUENTA_CERRADA' });
    }
    return cuenta;
  }

  private async obtenerCuentaDestino(numero: string): Promise<CuentaInterna> {
    try {
      return await this.cuentas.obtenerPorNumero(numero);
    } catch (error) {
      if (error instanceof AppError && error.code === 'NOT_FOUND') throw AppError.notFound('La cuenta de destino no existe');
      throw error;
    }
  }
}

export const transferenciaService = new TransferenciaService();
