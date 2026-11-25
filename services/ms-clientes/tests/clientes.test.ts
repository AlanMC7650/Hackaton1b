import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { EstadoCliente, RolCliente } from '@chuno/shared';

interface FakeCliente {
  id: string;
  ci: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  passwordHash: string;
  rol: RolCliente;
  estado: EstadoCliente;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const store = new Map<string, FakeCliente>();
let seq = 1;

jest.mock('../src/repositories/cliente.repository', () => ({
  ClienteRepository: jest.fn().mockImplementation(() => ({
    findById: async (id: string) => store.get(id) ?? null,
    findByCi: async (ci: string) => Array.from(store.values()).find((c) => c.ci === ci) ?? null,
    findByEmail: async (email: string) =>
      Array.from(store.values()).find((c) => c.email === email.trim().toLowerCase()) ?? null,
    search: async (q?: string) => {
      const all = Array.from(store.values());
      if (!q?.trim()) return all;
      const term = q.trim().toLowerCase();
      return all.filter(
        (c) =>
          c.ci.toLowerCase().includes(term) ||
          c.nombres.toLowerCase().includes(term) ||
          c.apellidos.toLowerCase().includes(term),
      );
    },
    createAndSave: async (data: Partial<FakeCliente>) => {
      const id = `00000000-0000-4000-8000-00000000000${seq++}`;
      const record: FakeCliente = {
        id,
        ci: data.ci!,
        nombres: data.nombres!,
        apellidos: data.apellidos!,
        email: data.email!,
        telefono: data.telefono ?? null,
        direccion: data.direccion ?? null,
        passwordHash: data.passwordHash!,
        rol: data.rol ?? RolCliente.CLIENTE,
        estado: data.estado ?? EstadoCliente.ACTIVO,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(id, record);
      return record;
    },
    save: async (cliente: FakeCliente) => {
      cliente.updatedAt = new Date();
      store.set(cliente.id, cliente);
      return cliente;
    },
  })),
}));

import { app } from '../src/app';

const ADMIN_ID = '11111111-1111-4111-8111-111111111101';
const CLIENTE_ID = '22222222-2222-4222-8222-222222222201';

describe('ms-clientes: HU-03 y HU-04', () => {
  beforeEach(async () => {
    store.clear();
    seq = 1;
    const hash = await bcrypt.hash('Cliente123!', 4);
    store.set(CLIENTE_ID, {
      id: CLIENTE_ID,
      ci: '6000001',
      nombres: 'Carlos',
      apellidos: 'Mamani',
      email: 'carlos@chuno.bo',
      telefono: '71234501',
      direccion: 'La Paz',
      passwordHash: hash,
      rol: RolCliente.CLIENTE,
      estado: EstadoCliente.ACTIVO,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('POST /clientes/auth/login devuelve JWT de 2h con sub y rol', async () => {
    const res = await request(app)
      .post('/clientes/auth/login')
      .send({ email: 'CARLOS@chuno.bo', password: 'Cliente123!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toEqual({
      id: CLIENTE_ID,
      email: 'carlos@chuno.bo',
      rol: RolCliente.CLIENTE,
      nombreCompleto: 'Carlos Mamani',
    });

    const decoded = jwt.decode(res.body.token) as { sub: string; rol: string; exp: number; iat: number };
    expect(decoded.sub).toBe(CLIENTE_ID);
    expect(decoded.rol).toBe(RolCliente.CLIENTE);
    expect(decoded.exp - decoded.iat).toBe(7200);
  });

  it('bloquea la cuenta por 5 minutos tras 3 intentos fallidos', async () => {
    for (let i = 0; i < 3; i++) {
      const fail = await request(app)
        .post('/clientes/auth/login')
        .send({ email: 'carlos@chuno.bo', password: 'WrongPassword' });
      expect(fail.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/clientes/auth/login')
      .send({ email: 'carlos@chuno.bo', password: 'Cliente123!' });
    expect(blocked.status).toBe(401);
    expect(blocked.body.message).toMatch(/bloqueada/i);
  });

  it('impide entrar a un cliente en estado BAJA', async () => {
    const c = store.get(CLIENTE_ID)!;
    c.estado = EstadoCliente.BAJA;

    const res = await request(app)
      .post('/clientes/auth/login')
      .send({ email: 'carlos@chuno.bo', password: 'Cliente123!' });
    expect(res.status).toBe(401);
  });

  it('ADMIN crea cliente sin devolver passwordHash y rechaza CI duplicado con 409', async () => {
    const createRes = await request(app)
      .post('/clientes')
      .set('x-user-id', ADMIN_ID)
      .set('x-user-rol', RolCliente.ADMIN)
      .send({
        ci: '7000001',
        nombres: 'Ana',
        apellidos: 'Torrez',
        email: 'ana@chuno.bo',
        password: 'Password123!',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.passwordHash).toBeUndefined();
    expect(createRes.body.estado).toBe(EstadoCliente.ACTIVO);

    const dupRes = await request(app)
      .post('/clientes')
      .set('x-user-id', ADMIN_ID)
      .set('x-user-rol', RolCliente.ADMIN)
      .send({
        ci: '7000001',
        nombres: 'Otra',
        apellidos: 'Persona',
        email: 'otra@chuno.bo',
        password: 'Password123!',
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.code).toBe('CONFLICT');
  });

  it('GET /clientes/me devuelve los datos del cliente autenticado', async () => {
    const res = await request(app)
      .get('/clientes/me')
      .set('x-user-id', CLIENTE_ID)
      .set('x-user-rol', RolCliente.CLIENTE);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(CLIENTE_ID);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('DELETE /clientes/:id realiza baja lógica y GET /internal/clientes/:id exige clave interna', async () => {
    const delRes = await request(app)
      .delete(`/clientes/${CLIENTE_ID}`)
      .set('x-user-id', ADMIN_ID)
      .set('x-user-rol', RolCliente.ADMIN);
    expect(delRes.status).toBe(200);
    expect(delRes.body.estado).toBe(EstadoCliente.BAJA);

    const noKey = await request(app).get(`/internal/clientes/${CLIENTE_ID}`);
    expect(noKey.status).toBe(401);

    const withKey = await request(app)
      .get(`/internal/clientes/${CLIENTE_ID}`)
      .set('x-internal-key', process.env.INTERNAL_API_KEY!);
    expect(withKey.status).toBe(200);
    expect(withKey.body).toEqual({
      id: CLIENTE_ID,
      nombreCompleto: 'Carlos Mamani',
      estado: EstadoCliente.BAJA,
    });
  });
});
