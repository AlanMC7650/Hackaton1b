import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AppError, createLogger, errorHandler, requestId } from '@chuno/shared';
import { createHealthRouter } from './routes/health.routes';

const SERVICE_NAME = 'mock-externos';

export function createApp() {
  const app = express();
  const logger = createLogger(SERVICE_NAME);

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(cors());
  app.use((req, res, next) => {
    res.once('finish', () => {
      const context = { method: req.method, statusCode: res.statusCode };
      if (res.statusCode >= 500) logger.warn('http.response', context);
      else logger.info('http.response', context);
    });
    next();
  });

  app.use(express.json());
  app.use('/health', createHealthRouter(SERVICE_NAME));

  // TODO HU-07: montar routers de empresas de servicios y red interbancaria ACH

  app.use((_req, _res, next) => {
    next(new AppError('NOT_FOUND', 'Ruta no encontrada'));
  });
  app.use(errorHandler);
  return app;
}

export const app = createApp();
