import express from 'express';
import request from 'supertest';
import { AppError, EstadoCuenta, EstadoPago, HEADERS, OrigenMovimiento, RolCliente, errorHandler } from '@chuno/shared';
import { TipoEmpresa, type EmpresaEntity } from '../src/entities/empresa.entity';
import type { PagoEntity } from '../src/entities/pago.entity';
import { PagosController } from '../src/controllers/pagos.controller';
import { createPagosRouter } from '../src/routes/pagos.routes';
import { PagoService } from '../src/services/pago.service';
import type { EmpresaRepository } from '../src/repositories/empresa.repository';
import type { CrearPagoRecord, PagoRepository } from '../src/repositories/pago.repository';
import type { CuentasClient } from '../src/clients/cuentas.client';
import type { ExternosClient } from '../src/clients/externos.client';

const CLIENTE_ID = '11111111-1111-4111-8111-111111111111';
const OTRO_CLIENTE_ID = '22222222-2222-4222-8222-222222222222';
const CUENTA_ID = '33333333-3333-4333-8333-333333333333';
const EMPRESA_LUZ: EmpresaEntity = {
  id: '44444444-4444-4444-8444-444444444444',
  codigo: 'LUZ',
  nombre: 'Electricidad',
  tipo: TipoEmpresa.LUZ,
  activo: true,
  createdAt: new Date('2026-11-24T18:00:00Z'),
  updatedAt: new Date('2026-11-24T18:00:00Z'),
};

function buildTestHarness() {
  const pagosStore: PagoEntity[] = [];

  const empresaRepo = {
    findActivas: jest.fn(async () => [EMPRESA_LUZ]),
    findByCodigo: jest.fn(async (codigo: string) => (codigo.trim().toUpperCase() === 'LUZ' ? EMPRESA_LUZ : null)),
  } as unknown as EmpresaRepository;

  const pagoRepo = {
    create: jest.fn(async (data: CrearPagoRecord) => {
      const nuevo: PagoEntity = {
        id: `55555555-5555-4555-8555-55555555555${pagosStore.length + 1}`,
        ...data,
        empresa: EMPRESA_LUZ,
        comprobante: null,
        motivo: null,
        createdAt: new Date('2026-11-24T19:00:00Z'),
        updatedAt: new Date('2026-11-24T19:00:00Z'),
      };
      pagosStore.unshift(nuevo);
      return nuevo;
    }),
    updateEstado: jest.fn(
      async (id: string, estado: EstadoPago, patch: { comprobante?: string | null; motivo?: string | null } = {}) => {
        const pago = pagosStore.find((p) => p.id === id);
        if (!pago) throw new Error('Pago no encontrado');
        pago.estado = estado;
        if (patch.comprobante !== undefined) pago.comprobante = patch.comprobante;
        if (patch.motivo !== undefined) pago.motivo = patch.motivo;
        pago.updatedAt = new Date('2026-11-24T19:01:00Z');
        return { ...pago };
      },
    ),
    findById: jest.fn(async (id: string) => pagosStore.find((p) => p.id === id) ?? null),
    findByClienteId: jest.fn(async (clienteId: string) => pagosStore.filter((p) => p.clienteId === clienteId)),
    findAll: jest.fn(async () => [...pagosStore]),
  } as unknown as PagoRepository;

  const cuentasClient = {
    obtenerCuenta: jest.fn(async () => ({
      id: CUENTA_ID,
      numero: '1000000001',
      clienteId: CLIENTE_ID,
      saldo: 500,
      estado: EstadoCuenta.ACTIVA,
    })),
    debitar: jest.fn(async () => ({
      id: 'mov-deb-1',
      cuentaId: CUENTA_ID,
      tipo: 'DEBITO',
      origen: OrigenMovimiento.PAGO_SERVICIO,
      monto: 185.5,
      saldoResultante: 314.5,
      referencia: 'ref',
      glosa: 'Pago',
    })),
    acreditar: jest.fn(async () => ({
      id: 'mov-rev-1',
      cuentaId: CUENTA_ID,
      tipo: 'CREDITO',
      origen: OrigenMovimiento.REVERSION,
      monto: 185.5,
      saldoResultante: 500,
      referencia: 'ref',
      glosa: 'Reversión',
    })),
  } as unknown as jest.Mocked<CuentasClient>;

  const externosClient = {
    consultarDeuda: jest.fn(async (_empresa: string, codigoCliente: string) => ({
      codigoCliente,
      titular: 'Juan Pérez',
      periodo: '2026-11',
      monto: 185.5,
    })),
    confirmarPago: jest.fn(async () => ({ comprobante: 'COMP-LUZ-12345678' })),
  } as unknown as jest.Mocked<ExternosClient>;

  const service = new PagoService(empresaRepo, pagoRepo, cuentasClient, externosClient);
  const controller = new PagosController(service);

  const app = express();
  app.use(express.json());
  app.use('/pagos', createPagosRouter(controller));
  app.use(errorHandler);

  return { app, pagosStore, cuentasClient, externosClient };
}

describe('ms-pagos · HU-08', () => {
  it('lista empresas y consulta deuda de un código válido', async () => {
    const { app } = buildTestHarness();

    const empRes = await request(app).get('/pagos/empresas').expect(200);
    expect(empRes.body).toHaveLength(1);
    expect(empRes.body[0].codigo).toBe('LUZ');

    const deudaRes = await request(app).get('/pagos/deuda').query({ empresa: 'LUZ', codigo: '1001' }).expect(200);
    expect(deudaRes.body).toMatchObject({
      empresa: { codigo: 'LUZ', nombre: 'Electricidad' },
      codigoCliente: '1001',
      monto: 185.5,
    });
  });

  it('procesa un pago completo, debita y guarda el comprobante', async () => {
    const { app, cuentasClient, externosClient } = buildTestHarness();

    const res = await request(app)
      .post('/pagos')
      .set(HEADERS.userId, CLIENTE_ID)
      .set(HEADERS.userRole, RolCliente.CLIENTE)
      .send({
        cuentaId: CUENTA_ID,
        empresaCodigo: 'LUZ',
        codigoClienteServicio: '1001',
      })
      .expect(201);

    expect(res.body.estado).toBe(EstadoPago.COMPLETADO);
    expect(res.body.comprobante).toBe('COMP-LUZ-12345678');
    expect(cuentasClient.debitar).toHaveBeenCalledTimes(1);
    expect(cuentasClient.acreditar).not.toHaveBeenCalled();
    expect(externosClient.confirmarPago).toHaveBeenCalledTimes(1);

    const historial = await request(app)
      .get('/pagos')
      .set(HEADERS.userId, CLIENTE_ID)
      .set(HEADERS.userRole, RolCliente.CLIENTE)
      .expect(200);
    expect(historial.body).toHaveLength(1);
    expect(historial.body[0].estado).toBe(EstadoPago.COMPLETADO);
  });

  it('rechaza con 403 si la cuenta pertenece a otro cliente', async () => {
    const { app, cuentasClient } = buildTestHarness();

    const res = await request(app)
      .post('/pagos')
      .set(HEADERS.userId, OTRO_CLIENTE_ID)
      .set(HEADERS.userRole, RolCliente.CLIENTE)
      .send({
        cuentaId: CUENTA_ID,
        empresaCodigo: 'LUZ',
        codigoClienteServicio: '1001',
      })
      .expect(403);

    expect(res.body.code).toBe('FORBIDDEN');
    expect(cuentasClient.debitar).not.toHaveBeenCalled();
  });

  it('marca el pago RECHAZADO sin llamar al proveedor si no hay saldo suficiente', async () => {
    const { app, cuentasClient, externosClient, pagosStore } = buildTestHarness();

    cuentasClient.debitar.mockRejectedValueOnce(
      AppError.businessRule('Saldo insuficiente', { motivo: 'SALDO_INSUFICIENTE' }),
    );

    const res = await request(app)
      .post('/pagos')
      .set(HEADERS.userId, CLIENTE_ID)
      .set(HEADERS.userRole, RolCliente.CLIENTE)
      .send({
        cuentaId: CUENTA_ID,
        empresaCodigo: 'LUZ',
        codigoClienteServicio: '1001',
      })
      .expect(422);

    expect(res.body.code).toBe('BUSINESS_RULE');
    expect(res.body.details.pago.estado).toBe(EstadoPago.RECHAZADO);
    expect(pagosStore[0].estado).toBe(EstadoPago.RECHAZADO);
    expect(externosClient.confirmarPago).not.toHaveBeenCalled();
    expect(cuentasClient.acreditar).not.toHaveBeenCalled();
  });

  it('compensa acreditando con REVERSION y marca REVERTIDO cuando falla el proveedor externo', async () => {
    const { app, cuentasClient, externosClient, pagosStore } = buildTestHarness();

    externosClient.confirmarPago.mockRejectedValueOnce(
      AppError.serviceUnavailable('El proveedor externo no pudo procesar el pago'),
    );

    const res = await request(app)
      .post('/pagos')
      .set(HEADERS.userId, CLIENTE_ID)
      .set(HEADERS.userRole, RolCliente.CLIENTE)
      .send({
        cuentaId: CUENTA_ID,
        empresaCodigo: 'LUZ',
        codigoClienteServicio: '12999',
      })
      .expect(503);

    expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.details.revertido).toBe(true);
    expect(res.body.details.pago.estado).toBe(EstadoPago.REVERTIDO);
    expect(pagosStore[0].estado).toBe(EstadoPago.REVERTIDO);

    expect(cuentasClient.debitar).toHaveBeenCalledTimes(1);
    expect(cuentasClient.acreditar).toHaveBeenCalledTimes(1);
    const debitRef = cuentasClient.debitar.mock.calls[0][1].referencia;
    const creditCall = cuentasClient.acreditar.mock.calls[0][1];
    expect(creditCall.referencia).toBe(debitRef);
    expect(creditCall.origen).toBe(OrigenMovimiento.REVERSION);
  });
});
