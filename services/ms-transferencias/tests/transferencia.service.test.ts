jest.mock('../src/data-source', () => ({
  AppDataSource: { isInitialized: false, getRepository: jest.fn(() => ({})) },
}));

import {
  AppError,
  EstadoCuenta,
  EstadoTransferencia,
  OrigenMovimiento,
  RolCliente,
  TipoTransferencia,
} from '@chuno/shared';
import type { CuentaInterna, Identity } from '@chuno/shared';
import { TransferenciaService } from '../src/services/transferencia.service';
import type { CrearTransferenciaDto } from '../src/schemas/transferencia.schema';

const CLIENTE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CLIENTE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const REFERENCIA = '11111111-1111-4111-8111-111111111111';

const identidad: Identity = { userId: CLIENTE_A, rol: RolCliente.CLIENTE };

const cuenta = (datos: Partial<CuentaInterna> & Pick<CuentaInterna, 'id' | 'numero' | 'clienteId'>): CuentaInterna => ({
  saldo: 1000,
  estado: EstadoCuenta.ACTIVA,
  ...datos,
});

const origen = cuenta({ id: 'c-origen', numero: '1000000001', clienteId: CLIENTE_A });
const propia = cuenta({ id: 'c-propia', numero: '1000000002', clienteId: CLIENTE_A });
const ajena = cuenta({ id: 'c-ajena', numero: '2000000001', clienteId: CLIENTE_B });

function saldoInsuficiente(): AppError {
  return new AppError('BUSINESS_RULE', 'Saldo insuficiente', 422, { motivo: 'SALDO_INSUFICIENTE' });
}

function crearServicio(destino?: CuentaInterna) {
  const repo = {
    findByReferencia: jest.fn().mockResolvedValue(null),
    crear: jest.fn(async (datos: object) => ({ id: 'tr-1', createdAt: new Date(), ...datos })),
    findByCliente: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
  };
  const cuentas = {
    obtenerPorId: jest.fn().mockResolvedValue(origen),
    obtenerPorNumero: jest.fn().mockResolvedValue(destino ?? propia),
    transferir: jest.fn().mockResolvedValue({}),
    debitar: jest.fn().mockResolvedValue({}),
    acreditar: jest.fn().mockResolvedValue({}),
  };
  const externos = {
    listarBancos: jest.fn().mockResolvedValue(['Banco Andino', { codigo: 'BSOL', nombre: 'Banco Sol' }]),
    enviarOrden: jest.fn().mockResolvedValue({ estado: 'ACEPTADA', codigoAch: 'ACH-123' }),
  };
  const servicio = new TransferenciaService(repo as never, cuentas as never, externos as never);
  return { servicio, repo, cuentas, externos };
}

const dtoPropia: CrearTransferenciaDto = {
  tipo: TipoTransferencia.PROPIA,
  cuentaOrigenId: 'c-origen',
  cuentaDestinoNumero: '1000000002',
  monto: 100,
  referencia: REFERENCIA,
};
const dtoTercero: CrearTransferenciaDto = {
  tipo: TipoTransferencia.TERCERO,
  cuentaOrigenId: 'c-origen',
  cuentaDestinoNumero: '2000000001',
  monto: 250.5,
  referencia: REFERENCIA,
};
const dtoInterbancaria: CrearTransferenciaDto = {
  tipo: TipoTransferencia.INTERBANCARIA,
  cuentaOrigenId: 'c-origen',
  bancoDestino: 'BSOL',
  cuentaDestinoNumero: '555000111',
  titularDestino: 'Juan Perez',
  monto: 300,
  referencia: REFERENCIA,
};

describe('HU-09: transferencias entre cuentas del banco', () => {
  it('PROPIA: usa el endpoint interno transferir y queda COMPLETADA', async () => {
    const { servicio, cuentas, repo } = crearServicio(propia);
    const { transferencia, repetida } = await servicio.crear(identidad, dtoPropia);

    expect(repetida).toBe(false);
    expect(cuentas.transferir).toHaveBeenCalledWith({
      cuentaOrigenId: 'c-origen',
      cuentaDestinoId: 'c-propia',
      monto: 100,
      referencia: REFERENCIA,
      glosa: expect.any(String),
    });
    expect(cuentas.debitar).not.toHaveBeenCalled();
    expect(transferencia.estado).toBe(EstadoTransferencia.COMPLETADA);
    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: CLIENTE_A, bancoDestino: 'CHUNO', cuentaDestinoNumero: '1000000002' }),
    );
  });

  it('TERCERO: acepta una cuenta de otro cliente', async () => {
    const { servicio } = crearServicio(ajena);
    const { transferencia } = await servicio.crear(identidad, dtoTercero);
    expect(transferencia.estado).toBe(EstadoTransferencia.COMPLETADA);
    expect(transferencia.monto).toBe(250.5);
  });

  it('PROPIA con cuenta destino de otro cliente → 422 y no mueve dinero', async () => {
    const { servicio, cuentas } = crearServicio(ajena);
    await expect(servicio.crear(identidad, dtoPropia)).rejects.toMatchObject({ code: 'BUSINESS_RULE', status: 422 });
    expect(cuentas.transferir).not.toHaveBeenCalled();
  });

  it('TERCERO con cuenta destino propia → 422', async () => {
    const { servicio, cuentas } = crearServicio(propia);
    await expect(servicio.crear(identidad, dtoTercero)).rejects.toMatchObject({ code: 'BUSINESS_RULE' });
    expect(cuentas.transferir).not.toHaveBeenCalled();
  });

  it('misma cuenta de origen y destino → 422', async () => {
    const { servicio } = crearServicio(origen);
    await expect(servicio.crear(identidad, dtoPropia)).rejects.toMatchObject({ code: 'BUSINESS_RULE' });
  });

  it('cuenta de origen de otro cliente → 403', async () => {
    const { servicio, cuentas } = crearServicio(propia);
    cuentas.obtenerPorId.mockResolvedValue(ajena);
    await expect(servicio.crear(identidad, dtoPropia)).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(cuentas.transferir).not.toHaveBeenCalled();
  });

  it('cuenta destino inexistente → 404', async () => {
    const { servicio, cuentas } = crearServicio();
    cuentas.obtenerPorNumero.mockRejectedValue(new AppError('NOT_FOUND', 'x', 404));
    await expect(servicio.crear(identidad, dtoTercero)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('sin saldo → queda RECHAZADA con motivo (no lanza error)', async () => {
    const { servicio, cuentas } = crearServicio(propia);
    cuentas.transferir.mockRejectedValue(saldoInsuficiente());
    const { transferencia } = await servicio.crear(identidad, dtoPropia);
    expect(transferencia.estado).toBe(EstadoTransferencia.RECHAZADA);
    expect(transferencia.motivo).toBe('Saldo insuficiente');
  });

  it('misma referencia: devuelve la transferencia anterior sin tocar cuentas', async () => {
    const { servicio, repo, cuentas } = crearServicio(propia);
    repo.findByReferencia.mockResolvedValue({ id: 'previa', clienteId: CLIENTE_A, estado: EstadoTransferencia.COMPLETADA });
    const { transferencia, repetida } = await servicio.crear(identidad, dtoPropia);
    expect(repetida).toBe(true);
    expect(transferencia.id).toBe('previa');
    expect(cuentas.obtenerPorId).not.toHaveBeenCalled();
    expect(cuentas.transferir).not.toHaveBeenCalled();
  });

  it('referencia de otro cliente → 409', async () => {
    const { servicio, repo } = crearServicio(propia);
    repo.findByReferencia.mockResolvedValue({ id: 'previa', clienteId: CLIENTE_B });
    await expect(servicio.crear(identidad, dtoPropia)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('HU-10: transferencias interbancarias', () => {
  it('acepta el intermediario → COMPLETADA con su código', async () => {
    const { servicio, cuentas, externos } = crearServicio();
    const { transferencia } = await servicio.crear(identidad, dtoInterbancaria);

    expect(cuentas.debitar).toHaveBeenCalledWith('c-origen', {
      monto: 300,
      referencia: REFERENCIA,
      origen: OrigenMovimiento.TRANSFERENCIA,
      glosa: expect.any(String),
    });
    expect(externos.enviarOrden).toHaveBeenCalledWith({
      bancoDestino: 'BSOL',
      cuentaDestino: '555000111',
      titular: 'Juan Perez',
      monto: 300,
      referencia: REFERENCIA,
    });
    expect(cuentas.acreditar).not.toHaveBeenCalled();
    expect(transferencia.estado).toBe(EstadoTransferencia.COMPLETADA);
    expect(transferencia.codigoExterno).toBe('ACH-123');
    expect(transferencia.cuentaDestinoId).toBeNull();
  });

  it('rechaza el intermediario → acredita de vuelta (REVERSION) y queda REVERTIDA', async () => {
    const { servicio, cuentas, externos } = crearServicio();
    externos.enviarOrden.mockRejectedValue(new AppError('BUSINESS_RULE', 'rechazada', 422));
    const { transferencia } = await servicio.crear(identidad, dtoInterbancaria);

    expect(cuentas.acreditar).toHaveBeenCalledWith('c-origen', {
      monto: 300,
      referencia: REFERENCIA,
      origen: OrigenMovimiento.REVERSION,
      glosa: expect.stringContaining('Reversión'),
    });
    expect(transferencia.estado).toBe(EstadoTransferencia.REVERTIDA);
    expect(transferencia.codigoExterno).toBeNull();
    expect(transferencia.motivo).toContain('rechazó');
  });

  it('el intermediario no responde → también se revierte', async () => {
    const { servicio, cuentas, externos } = crearServicio();
    externos.enviarOrden.mockRejectedValue(AppError.serviceUnavailable());
    const { transferencia } = await servicio.crear(identidad, dtoInterbancaria);
    expect(cuentas.acreditar).toHaveBeenCalledTimes(1);
    expect(transferencia.estado).toBe(EstadoTransferencia.REVERTIDA);
    expect(transferencia.motivo).toContain('no respondió');
  });

  it('sin saldo → RECHAZADA y no se llama al intermediario', async () => {
    const { servicio, cuentas, externos } = crearServicio();
    cuentas.debitar.mockRejectedValue(saldoInsuficiente());
    const { transferencia } = await servicio.crear(identidad, dtoInterbancaria);
    expect(transferencia.estado).toBe(EstadoTransferencia.RECHAZADA);
    expect(externos.enviarOrden).not.toHaveBeenCalled();
    expect(cuentas.acreditar).not.toHaveBeenCalled();
  });

  it('si la compensación falla de forma persistente → 503 y no guarda como REVERTIDA', async () => {
    const { servicio, cuentas, externos, repo } = crearServicio();
    externos.enviarOrden.mockRejectedValue(new AppError('BUSINESS_RULE', 'rechazada', 422));
    cuentas.acreditar.mockRejectedValue(AppError.serviceUnavailable());
    await expect(servicio.crear(identidad, dtoInterbancaria)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(cuentas.acreditar).toHaveBeenCalledTimes(3);
    expect(repo.crear).not.toHaveBeenCalled();
  });
});

describe('Historial y bancos', () => {
  it('el CLIENTE solo ve las suyas; el ADMIN ve todas', async () => {
    const { servicio, repo } = crearServicio();
    await servicio.listar(identidad, { limit: 10 });
    expect(repo.findByCliente).toHaveBeenCalledWith(CLIENTE_A, 10);

    await servicio.listar({ userId: 'admin', rol: RolCliente.ADMIN }, { limit: 10, clienteId: CLIENTE_B });
    expect(repo.findAll).toHaveBeenCalledWith(10, CLIENTE_B);
  });

  it('normaliza la lista de bancos del intermediario', async () => {
    const { servicio } = crearServicio();
    await expect(servicio.listarBancos()).resolves.toEqual([
      { codigo: 'Banco Andino', nombre: 'Banco Andino' },
      { codigo: 'BSOL', nombre: 'Banco Sol' },
    ]);
  });
});
