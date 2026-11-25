import request from 'supertest';
import { app } from '../src/app';

describe('Infraestructura: Gateway', () => {
  it('GET /health responde 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: 'gateway',
      status: 'OK',
      db: 'not_configured',
    });
  });

  it('bloquea rutas /internal con 404', async () => {
    const response = await request(app).get('/api/cuentas/internal/cuentas/123');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('bloquea /internal aunque venga codificado', async () => {
    const response = await request(app).get('/api/cuentas/%2569nternal/cuentas/123');
    expect(response.status).toBe(404);
  });

  it('exige JWT en rutas /api que no son el login', async () => {
    const response = await request(app).get('/api/prestamos');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });
});
