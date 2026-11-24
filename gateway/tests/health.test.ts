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

  it('bloquea rutas /internal con 403', async () => {
    const response = await request(app).get('/api/cuentas/internal/cuentas/123');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });
});
