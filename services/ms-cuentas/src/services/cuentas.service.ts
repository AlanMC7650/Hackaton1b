import { randomInt } from 'node:crypto';
import {
  AppError,
  type CuentaInterna,
  EstadoCliente,
  EstadoCuenta,
  type MovimientoRequest,
  OrigenMovimiento,
  RolCliente,
  TipoMovimiento,
  type TransferirRequest,
} from '@chuno/shared';
import { buscarCliente } from '../clients/clientes.client';
import { Cuenta } from '../entities/cuenta.entity';
import { CuentasRepository } from '../repositories/cuentas.repository';
import { saldoMaximo } from '../schemas/cuentas.schemas';

export interface Usuario {
  id: string;
  rol: RolCliente;
}

export class CuentasService {
  constructor(private readonly repository = new CuentasRepository()) {}

  async abrir(usuario: Usuario, clienteId?: string, alias: string | null = null) {
    const titular = usuario.rol === RolCliente.CLIENTE ? usuario.id : clienteId;
    if (!titular) throw AppError.badRequest('Indique el cliente titular');
    if (clienteId && clienteId !== titular) throw AppError.forbidden('No puede abrir cuentas para otro cliente');

    const cliente = await buscarCliente(titular);
    if (cliente.estado !== EstadoCliente.ACTIVO) {
      throw AppError.businessRule('El cliente debe estar activo');
    }
    for (let intento = 0; intento < 5; intento++) {
      const numero = String(randomInt(10_000_000_000)).padStart(10, '0');
      const cuenta = await this.repository.crear(titular, numero, alias);
      if (cuenta) return cuenta;
    }
    throw AppError.serviceUnavailable('No se pudo generar un número de cuenta');
  }

  listar(usuario: Usuario, clienteId?: string) {
    if (!clienteId && usuario.rol === RolCliente.CLIENTE) return this.repository.listar(usuario.id);
    if (clienteId) this.verificarTitular(usuario, clienteId);
    return this.repository.listar(clienteId);
  }

  async detalle(id: string, usuario: Usuario) {
    const cuenta = await this.repository.buscar(id);
    this.verificarTitular(usuario, cuenta.clienteId);
    return cuenta;
  }

  async buscarInterna(id: string, porNumero = false): Promise<CuentaInterna> {
    const cuenta = porNumero ? await this.repository.buscarPorNumero(id) : await this.repository.buscar(id);
    const { id: cuentaId, numero, clienteId, saldo, estado } = cuenta;
    return { id: cuentaId, numero, clienteId, saldo, estado };
  }

  async editarAlias(id: string, usuario: Usuario, alias: string | null) {
    return this.repository.transaction(async (repo) => {
      const cuenta = await repo.buscar(id, true);
      this.verificarTitular(usuario, cuenta.clienteId);
      cuenta.alias = alias;
      return repo.guardar(cuenta);
    });
  }

  async cerrar(id: string, usuario: Usuario) {
    await this.repository.transaction(async (repo) => {
      const cuenta = await repo.buscar(id, true);
      this.verificarTitular(usuario, cuenta.clienteId);
      if (cuenta.saldo !== 0) throw AppError.businessRule('Solo se puede cerrar una cuenta con saldo cero');
      if (cuenta.estado === EstadoCuenta.CERRADA) return;
      cuenta.estado = EstadoCuenta.CERRADA;
      await repo.guardar(cuenta);
    });
  }

  async extracto(id: string, usuario: Usuario) {
    await this.detalle(id, usuario);
    return this.repository.extracto(id);
  }

  mover(id: string, tipo: TipoMovimiento, datos: MovimientoRequest, usuario?: Usuario) {
    return this.repository.transaction(async (repo) => {
      const cuenta = await repo.buscar(id, true);
      if (usuario) this.verificarTitular(usuario, cuenta.clienteId);
      const anterior = await repo.buscarMovimiento(id, tipo, datos.referencia);
      return anterior ?? this.aplicarMovimiento(repo, cuenta, tipo, datos);
    });
  }

  transferir(datos: TransferirRequest) {
    const { cuentaOrigenId, cuentaDestinoId, referencia } = datos;
    if (cuentaOrigenId === cuentaDestinoId) throw AppError.businessRule('Las cuentas deben ser distintas');

    return this.repository.transaction(async (repo) => {
      const [primero, segundo] = [cuentaOrigenId, cuentaDestinoId].sort();
      const primeraCuenta = await repo.buscar(primero, true);
      const segundaCuenta = await repo.buscar(segundo, true);
      const [origen, destino] =
        primero === cuentaOrigenId ? [primeraCuenta, segundaCuenta] : [segundaCuenta, primeraCuenta];

      const debitoAnterior = await repo.buscarMovimiento(origen.id, TipoMovimiento.DEBITO, referencia);
      const creditoAnterior = await repo.buscarMovimiento(destino.id, TipoMovimiento.CREDITO, referencia);
      if (
        debitoAnterior &&
        creditoAnterior &&
        debitoAnterior.origen === OrigenMovimiento.TRANSFERENCIA &&
        creditoAnterior.origen === OrigenMovimiento.TRANSFERENCIA
      ) {
        return { debito: debitoAnterior, credito: creditoAnterior };
      }
      if (debitoAnterior || creditoAnterior) throw AppError.conflict('La referencia ya está en uso');

      const movimiento = { ...datos, origen: OrigenMovimiento.TRANSFERENCIA };
      const debito = await this.aplicarMovimiento(repo, origen, TipoMovimiento.DEBITO, movimiento);
      const credito = await this.aplicarMovimiento(repo, destino, TipoMovimiento.CREDITO, movimiento);
      return { debito, credito };
    });
  }

  private verificarTitular(usuario: Usuario, titular: string) {
    if (usuario.rol !== RolCliente.ADMIN && usuario.id !== titular) {
      throw AppError.forbidden('No puede acceder a la cuenta de otro cliente');
    }
  }

  private async aplicarMovimiento(
    repo: CuentasRepository,
    cuenta: Cuenta,
    tipo: TipoMovimiento,
    datos: MovimientoRequest,
  ) {
    if (cuenta.estado !== EstadoCuenta.ACTIVA) throw AppError.businessRule('La cuenta está cerrada');

    const saldoCentavos = Math.round(cuenta.saldo * 100);
    const montoCentavos = Math.round(datos.monto * 100);
    const saldoResultante =
      (tipo === TipoMovimiento.DEBITO ? saldoCentavos - montoCentavos : saldoCentavos + montoCentavos) / 100;
    if (saldoResultante < 0) {
      throw AppError.businessRule('Saldo insuficiente', { motivo: 'SALDO_INSUFICIENTE' });
    }
    if (saldoResultante > saldoMaximo) throw AppError.businessRule('El saldo excede el máximo permitido');

    cuenta.saldo = saldoResultante;
    await repo.guardar(cuenta);
    return repo.registrarMovimiento({ ...datos, cuentaId: cuenta.id, tipo, saldoResultante });
  }
}
