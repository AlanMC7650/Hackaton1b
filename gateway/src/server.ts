import 'dotenv/config';
import { logger, requirePort } from '@chuno/shared';
import { app } from './app';

const port = requirePort('PORT', 8080);

const server = app.listen(port, () => {
  logger.info(`gateway escuchando en el puerto ${port}`);
});

const shutdown = (signal: string): void => {
  logger.info(`gateway recibió ${signal}; cerrando`);
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
