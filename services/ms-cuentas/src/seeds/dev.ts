import { logger } from '@chuno/shared';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { CuentasRepository } from '../repositories/cuentas.repository';

// IDs publicados en la semilla de ms-clientes. El contenedor init siembra clientes primero.
const clientesDemo = [
  '22222222-2222-4222-8222-222222222201',
  '22222222-2222-4222-8222-222222222202',
  '22222222-2222-4222-8222-222222222203',
];

async function main() {
  const valores = process.env.CUENTAS_SEED_CLIENT_IDS?.trim();
  const clienteIds = valores
    ? z.array(z.guid()).parse(valores.split(',').map((id) => id.trim().toLowerCase()))
    : clientesDemo;
  await AppDataSource.initialize();
  try {
    await new CuentasRepository().sembrar([...new Set(clienteIds)]);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  logger.error('No se pudo cargar la semilla de cuentas', error);
  process.exitCode = 1;
});
