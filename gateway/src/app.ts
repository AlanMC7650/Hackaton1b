import 'dotenv/config';
import express, { type Request, type RequestHandler, type Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { ServerResponse } from 'node:http';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { AppError, createLogger, errorHandler } from '@chuno/shared';
import { jwtAuth } from './middlewares/auth.middleware';
import { createHealthRouter } from './routes/health.routes';

const IDENTITY_HEADERS = ['x-user-id', 'x-user-rol'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const blockInternalAccess: RequestHandler = (req, _res, next) => {
  let path = req.originalUrl.split('?')[0];
  for (let attempt = 0; attempt < 5; attempt++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      next(new AppError('VALIDATION_ERROR', 'Ruta inválida'));
      return;
    }
    if (decoded === path) {
      const segments = decoded
        .replace(/\\/g, '/')
        .split(/[/?#]/)
        .map((segment) => segment.split(';')[0].toLowerCase());
      if (segments.includes('internal')) {
        // 404 y no 403: desde afuera las rutas internas simplemente no existen.
        next(new AppError('NOT_FOUND', 'Ruta no encontrada'));
        return;
      }
      next();
      return;
    }
    path = decoded;
  }
  next(new AppError('VALIDATION_ERROR', 'La ruta contiene demasiados niveles de codificación'));
};

export function createApp() {
  const app = express();
  const logger = createLogger('gateway');
  app.disable('x-powered-by');

  const configuredOrigins = process.env.CORS_ORIGIN?.trim();
  app.use(
    cors({
      origin:
        !configuredOrigins || configuredOrigins === '*'
          ? true
          : configuredOrigins
              .split(',')
              .map((origin) => origin.trim())
              .filter(Boolean),
    }),
  );

  app.use((req, res, next) => {
    const incoming = req.get('X-Request-Id');
    const requestId = incoming && uuidPattern.test(incoming) ? incoming : randomUUID();
    req.headers['x-request-id'] = requestId;
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.once('finish', () => {
      const context = { method: req.method, statusCode: res.statusCode, requestId };
      if (res.statusCode >= 500) logger.warn('http.response', context);
      else logger.info('http.response', context);
    });
    next();
  });

  app.use(blockInternalAccess);

  app.use((req, _res, next) => {
    for (const header of IDENTITY_HEADERS) delete req.headers[header];
    next();
  });

  app.use(jwtAuth());
  app.use(express.json());
  app.use('/health', createHealthRouter('gateway'));

  const routes: Array<{ prefix: string; target: string; forwardedPrefix: string }> = [
    {
      prefix: '/api/clientes',
      target: process.env.CLIENTES_SERVICE_URL ?? 'http://ms-clientes:3001',
      forwardedPrefix: '/clientes',
    },
    {
      prefix: '/api/cuentas',
      target: process.env.CUENTAS_SERVICE_URL ?? 'http://ms-cuentas:3002',
      forwardedPrefix: '/cuentas',
    },
    {
      prefix: '/api/pagos',
      target: process.env.PAGOS_SERVICE_URL ?? 'http://ms-pagos:3003',
      forwardedPrefix: '/pagos',
    },
    {
      prefix: '/api/transferencias',
      target: process.env.TRANSFERENCIAS_SERVICE_URL ?? 'http://ms-transferencias:3004',
      forwardedPrefix: '/transferencias',
    },
    {
      prefix: '/api/prestamos',
      target: process.env.PRESTAMOS_SERVICE_URL ?? 'http://ms-prestamos:3005',
      forwardedPrefix: '/prestamos',
    },
  ];

  for (const { prefix, target, forwardedPrefix } of routes) {
    app.use(
      prefix,
      createProxyMiddleware<Request, Response>({
        target,
        changeOrigin: true,
        xfwd: true,
        proxyTimeout: 3000,
        timeout: 5000,
        pathRewrite: (_path, req) => {
          const suffix = req.originalUrl.slice(prefix.length);
          return forwardedPrefix + suffix;
        },
        on: {
          proxyReq: (proxyReq, req) => {
            proxyReq.setHeader('X-Request-Id', String(req.headers['x-request-id']));
            fixRequestBody(proxyReq, req);
          },
          error: (_error, req, res) => {
            logger.warn('proxy.unavailable', { prefix, requestId: req.headers['x-request-id'] });
            if (!(res instanceof ServerResponse) || res.headersSent) {
              res.destroy();
              return;
            }
            const error = new AppError('SERVICE_UNAVAILABLE', 'El servicio de destino no está disponible');
            res.writeHead(error.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(error.toResponse()));
          },
        },
      }),
    );
  }

  app.use((_req, _res, next) => {
    next(new AppError('NOT_FOUND', 'Ruta no encontrada'));
  });
  app.use(errorHandler);
  return app;
}

export const app = createApp();
