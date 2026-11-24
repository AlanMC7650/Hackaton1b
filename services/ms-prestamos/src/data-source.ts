import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const SERVICE_SCHEMA = 'prestamos';

if (process.env.DB_SCHEMA && process.env.DB_SCHEMA !== SERVICE_SCHEMA) {
  throw new Error('DB_SCHEMA debe ser prestamos para ms-prestamos');
}

const poolMax = Number(process.env.DB_POOL_MAX ?? '5');

if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 5) {
  throw new Error('DB_POOL_MAX debe ser un entero entre 1 y 5');
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: SERVICE_SCHEMA,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [__dirname + '/entities/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'migrations',
  synchronize: false,
  connectTimeoutMS: 3000,
  extra: {
    max: poolMax,
    query_timeout: 3000,
    options: '-c search_path=prestamos',
  },
  uuidExtension: 'pgcrypto',
  installExtensions: false,
});
