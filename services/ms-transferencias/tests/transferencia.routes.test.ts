import request from 'supertest';
jest.mock('../src/data-source', () => ({
  AppDataSource: { isInitialized: false, initialize: jest.fn(), createQueryBuilder: jest.fn(), getRepository: jest.fn(() => ({})) },
}));
import { app } from '../src/app';

const cliente = { 'x-user-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x-user-rol': 'CLIENTE' };
const admin = { 'x-user-id': 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'x-user-rol': 'ADMIN' };

const cuerpoValido = {
  tipo: 'TERCERO',
  cuentaOrigenId: '11111111-1111-4111-8111-111111111111',
  cuentaDestinoNumero: '2000000001',
  monto: 100,
};

describe('Rutas públicas de /transferencias', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('sin identidad → 401', async () => {
    await request(app).post('/transferencias').send(cuerpoValido).expect(401);
  });

  it('el ADMIN no puede operar → 403', async () => {
    const res = await request(app).post('/transferencias').set(admin).send(cuerpoValido);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('monto mayor a 50 000 → 400 con el formato { code, message, details }', async () => {
    const res = await request(app)
      .post('/transferencias')
      .set(cliente)
      .send({ ...cuerpoValido, monto: 50_000.01 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String), details: expect.any(Array) });
  });

  it('monto 0 o negativo → 400', async () => {
    await request(app).post('/transferencias').set(cliente).send({ ...cuerpoValido, monto: 0 }).expect(400);
    await request(app).post('/transferencias').set(cliente).send({ ...cuerpoValido, monto: -5 }).expect(400);
  });

  it('cuenta destino interna con formato inválido → 400', async () => {
    await request(app)
      .post('/transferencias')
      .set(cliente)
      .send({ ...cuerpoValido, cuentaDestinoNumero: '123' })
      .expect(400);
  });

  it('interbancaria sin titular → 400', async () => {
    await request(app)
      .post('/transferencias')
      .set(cliente)
      .send({ tipo: 'INTERBANCARIA', cuentaOrigenId: cuerpoValido.cuentaOrigenId, monto: 10, bancoDestino: 'BSOL', cuentaDestinoNumero: '555' })
      .expect(400);
  });

  it('tipo desconocido → 400', async () => {
    await request(app).post('/transferencias').set(cliente).send({ ...cuerpoValido, tipo: 'OTRA' }).expect(400);
  });

  it('limit inválido en el historial → 400', async () => {
    await request(app).get('/transferencias?limit=0').set(cliente).expect(400);
  });
});
