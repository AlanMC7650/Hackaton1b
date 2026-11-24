import 'dotenv/config';
import { logger, requirePort, startService } from '@chuno/shared';
import { app } from './app';
import { AppDataSource } from './data-source';
import { seedEmpresas } from './seeds/empresas.seed';

async function main(): Promise<void> {
  const port = requirePort('PORT', 3003);
  await startService({ app, dataSource: AppDataSource, port, name: 'ms-pagos' });
  await seedEmpresas(AppDataSource).catch((error: unknown) => {
    logger.warn('No se pudo ejecutar la semilla automática de empresas al iniciar', error);
  });
}

main().catch((error: unknown) => {
  logger.error('No se pudo iniciar ms-pagos', error);
  process.exit(1);
});
