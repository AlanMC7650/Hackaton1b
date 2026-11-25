import 'reflect-metadata';
import 'dotenv/config';
import { logger } from '@chuno/shared';
import { AppDataSource } from '../data-source';
import { seedEmpresas } from './empresas.seed';

async function runSeed(): Promise<void> {
  await AppDataSource.initialize();
  try {
    await seedEmpresas(AppDataSource);
    logger.info('Semilla de empresas de ms-pagos aplicada correctamente');
  } finally {
    await AppDataSource.destroy();
  }
}

runSeed().catch((error: unknown) => {
  logger.error('Error ejecutando semilla de ms-pagos', error);
  process.exit(1);
});
