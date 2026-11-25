import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import {
  AppError,
  EstadoCuenta,
  EstadoPago,
  OrigenMovimiento,
  RolCliente,
  errorHandler,
  requireInternalKey,
} from '@chuno/shared';
import { createApp as createExternosApp } from '../../mock-externos/src/app';
import { TipoEmpresa, type EmpresaEntity } from '../src/entities/empresa.entity';
import type { PagoEntity } from '../src/entities/pago.entity';
import { PagosController } from '../src/controllers/pagos.controller';
import { createPagosRouter } from '../src/routes/pagos.routes';
import { PagoService } from '../src/services/pago.service';
import type { EmpresaRepository } from '../src/repositories/empresa.repository';
import type { CrearPagoRecord, PagoRepository } from '../src/repositories/pago.repository';

function listen(app: express.Express): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

describe('Integración HTTP real: Gateway -> ms-pagos -> mock-externos + ms-cuentas', () => {
  const CLIENTE_ID = '11111111-1111-4111-8111-111111111111';
  const CUENTA_ID = '33333333-3333-4333-8333-333333333333';
  const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? 'infra-test-key-not-for-deployment';
  const JWT_SECRET = process.env.JWT_SECRET ?? 'infra-test-jwt-secret-not-for-deployment';

  let saldoCuenta = 250;
  const movimientosCuentas: Array<{ tipo: string; origen: string; monto: number; referencia: string }> = [];
  const pagosStore: PagoEntity[] = [];

  const empresasCatalogo: EmpresaEntity[] = [
    {
      id: '44444444-4444-4444-8444-444444444441',
      codigo: 'LUZ',
      nombre: 'Electricidad',
      tipo: TipoEmpresa.LUZ,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '44444444-4444-4444-8444-444444444442',
      codigo: 'AGUA',
      nombre: 'Agua Potable',
      tipo: TipoEmpresa.AGUA,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  let externosServer: Server;
  let cuentasServer: Server;
  let pagosServer: Server;
  let gatewayServer: Server;
  let gatewayUrl: string;
  let token: string;

  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.MOCK_MIN_DELAY_MS = '10';
    process.env.MOCK_MAX_DELAY_MS = '20';
    process.env.INTERNAL_API_KEY = INTERNAL_KEY;
    process.env.JWT_SECRET = JWT_SECRET;

    const externos = await listen(createExternosApp());
    externosServer = externos.server;
    process.env.EXTERNOS_SERVICE_URL = externos.url;

    const cuentasApp = express();
    cuentasApp.use('/internal', requireInternalKey(INTERNAL_KEY));
    cuentasApp.use(express.json());
    cuentasApp.get('/internal/cuentas/:id', (req, res, next) => {
      if (req.params.id !== CUENTA_ID) {
        next(AppError.notFound('Cuenta no encontrada'));
        return;
      }
      res.json({
        id: CUENTA_ID,
        numero: '1000000001',
        clienteId: CLIENTE_ID,
        saldo: saldoCuenta,
        estado: EstadoCuenta.ACTIVA,
      });
    });
    cuentasApp.post('/internal/cuentas/:id/debitar', (req, res, next) => {
      const { monto, referencia, origen } = req.body as {
        monto: number;
        referencia: string;
        origen: OrigenMovimiento;
      };
      if (saldoCuenta < monto) {
        next(AppError.businessRule('Saldo insuficiente', { motivo: 'SALDO_INSUFICIENTE' }));
        return;
      }
      saldoCuenta = Number((saldoCuenta - monto).toFixed(2));
      const mov = { tipo: 'DEBITO', origen, monto, referencia, saldoResultante: saldoCuenta };
      movimientosCuentas.push(mov);
      res.status(201).json(mov);
    });
    cuentasApp.post('/internal/cuentas/:id/acreditar', (req, res) => {
      const { monto, referencia, origen } = req.body as {
        monto: number;
        referencia: string;
        origen: OrigenMovimiento;
      };
      saldoCuenta = Number((saldoCuenta + monto).toFixed(2));
      const mov = { tipo: 'CREDITO', origen, monto, referencia, saldoResultante: saldoCuenta };
      movimientosCuentas.push(mov);
      res.status(201).json(mov);
    });
    cuentasApp.use(errorHandler);

    const cuentas = await listen(cuentasApp);
    cuentasServer = cuentas.server;
    process.env.CUENTAS_SERVICE_URL = cuentas.url;

    const empresaRepo = {
      findActivas: async () => empresasCatalogo,
      findByCodigo: async (codigo: string) =>
        empresasCatalogo.find((e) => e.codigo === codigo.trim().toUpperCase()) ?? null,
    } as unknown as EmpresaRepository;

    const pagoRepo = {
      create: async (data: CrearPagoRecord) => {
        const empresa = empresasCatalogo.find((e) => e.id === data.empresaId)!;
        const nuevo: PagoEntity = {
          id: `66666666-6666-4666-8666-66666666666${pagosStore.length + 1}`,
          ...data,
          empresa,
          comprobante: null,
          motivo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        pagosStore.unshift(nuevo);
        return nuevo;
      },
      updateEstado: async (
        id: string,
        estado: EstadoPago,
        patch: { comprobante?: string | null; motivo?: string | null } = {},
      ) => {
        const found = pagosStore.find((p) => p.id === id)!;
        found.estado = estado;
        if (patch.comprobante !== undefined) found.comprobante = patch.comprobante;
        if (patch.motivo !== undefined) found.motivo = patch.motivo;
        found.updatedAt = new Date();
        return { ...found };
      },
      findById: async (id: string) => pagosStore.find((p) => p.id === id) ?? null,
      findByClienteId: async (clienteId: string) => pagosStore.filter((p) => p.clienteId === clienteId),
      findAll: async () => [...pagosStore],
    } as unknown as PagoRepository;

    const pagosApp = express();
    pagosApp.use(express.json());
    pagosApp.use('/pagos', createPagosRouter(new PagosController(new PagoService(empresaRepo, pagoRepo))));
    pagosApp.use(errorHandler);

    const pagos = await listen(pagosApp);
    pagosServer = pagos.server;
    process.env.PAGOS_SERVICE_URL = pagos.url;

    const { createApp: createGatewayApp } = await import('../../../gateway/src/app');
    const gateway = await listen(createGatewayApp());
    gatewayServer = gateway.server;
    gatewayUrl = gateway.url;

    token = jwt.sign({ sub: CLIENTE_ID, rol: RolCliente.CLIENTE }, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '2h',
    });
  });

  afterAll(async () => {
    await Promise.all([
      closeServer(gatewayServer),
      closeServer(pagosServer),
      closeServer(cuentasServer),
      closeServer(externosServer),
    ]);
    process.env = originalEnv;
  });

  it('ejecuta flujo completo por HTTP real: empresas -> deuda -> pago exitoso -> compensación 999 -> rechazo sin saldo -> historial', async () => {
    // 1. Sin JWT responde 401 desde gateway
    const unauth = await fetch(`${gatewayUrl}/api/pagos/empresas`);
    expect(unauth.status).toBe(401);

    // 2. Listar empresas y consultar deuda en mock-externos real
    const empRes = await fetch(`${gatewayUrl}/api/pagos/empresas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(empRes.status).toBe(200);
    const empresas = (await empRes.json()) as Array<{ codigo: string }>;
    expect(empresas.map((e) => e.codigo)).toEqual(['LUZ', 'AGUA']);

    const deudaRes = await fetch(`${gatewayUrl}/api/pagos/deuda?empresa=LUZ&codigo=1001`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deudaRes.status).toBe(200);
    const deuda = (await deudaRes.json()) as { monto: number; titular: string };
    expect(deuda.monto).toBe(185.5);

    // 3. Pago exitoso (saldo baja de 250 a 64.50)
    const pagoOkRes = await fetch(`${gatewayUrl}/api/pagos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cuentaId: CUENTA_ID,
        empresaCodigo: 'LUZ',
        codigoClienteServicio: '1001',
      }),
    });
    expect(pagoOkRes.status).toBe(201);
    const pagoOk = (await pagoOkRes.json()) as { estado: string; comprobante: string };
    expect(pagoOk.estado).toBe(EstadoPago.COMPLETADO);
    expect(pagoOk.comprobante).toMatch(/^COMP-LUZ-/);
    expect(saldoCuenta).toBe(64.5);

    // 4. Compensación con código 12999 (mock-externos responde 502 -> ms-pagos acredita REVERSION y saldo vuelve a 64.50)
    saldoCuenta = 200;
    const pago999Res = await fetch(`${gatewayUrl}/api/pagos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cuentaId: CUENTA_ID,
        empresaCodigo: 'LUZ',
        codigoClienteServicio: '12999',
      }),
    });
    expect(pago999Res.status).toBe(503);
    const pago999Body = (await pago999Res.json()) as {
      details: { revertido: boolean; pago: { estado: string } };
    };
    expect(pago999Body.details.revertido).toBe(true);
    expect(pago999Body.details.pago.estado).toBe(EstadoPago.REVERTIDO);
    expect(saldoCuenta).toBe(200);

    // 5. Sin saldo suficiente (saldo 50 < deuda AGUA:1001 de 94.20 -> RECHAZADO 422)
    saldoCuenta = 50;
    const sinSaldoRes = await fetch(`${gatewayUrl}/api/pagos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cuentaId: CUENTA_ID,
        empresaCodigo: 'AGUA',
        codigoClienteServicio: '1001',
      }),
    });
    expect(sinSaldoRes.status).toBe(422);
    const sinSaldoBody = (await sinSaldoRes.json()) as {
      code: string;
      details: { pago: { estado: string } };
    };
    expect(sinSaldoBody.code).toBe('BUSINESS_RULE');
    expect(sinSaldoBody.details.pago.estado).toBe(EstadoPago.RECHAZADO);
    expect(saldoCuenta).toBe(50);

    // 6. Historial contiene los 3 pagos en orden inverso
    const histRes = await fetch(`${gatewayUrl}/api/pagos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(histRes.status).toBe(200);
    const historial = (await histRes.json()) as Array<{ estado: string }>;
    expect(historial.map((p) => p.estado)).toEqual([EstadoPago.RECHAZADO, EstadoPago.REVERTIDO, EstadoPago.COMPLETADO]);
  });
});
