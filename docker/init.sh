#!/bin/sh
# Aplica las migraciones de los 5 schemas y carga las semillas de desarrollo.
# Mientras no haya migraciones o semillas, continúa sin fallar.
set -eu

echo "[init] Aplicando migraciones"
DB_SCHEMA=clientes npm run migration:run --workspace=ms-clientes --if-present || true
DB_SCHEMA=cuentas npm run migration:run --workspace=ms-cuentas --if-present || true
DB_SCHEMA=pagos npm run migration:run --workspace=ms-pagos --if-present || true
DB_SCHEMA=transferencias npm run migration:run --workspace=ms-transferencias --if-present || true
DB_SCHEMA=prestamos npm run migration:run --workspace=ms-prestamos --if-present || true

echo "[init] Cargando semilla de desarrollo"
DB_SCHEMA=clientes npm run seed:dev --workspace=ms-clientes --if-present || true
DB_SCHEMA=cuentas npm run seed:dev --workspace=ms-cuentas --if-present || true
DB_SCHEMA=pagos npm run seed:dev --workspace=ms-pagos --if-present || true
DB_SCHEMA=transferencias npm run seed:dev --workspace=ms-transferencias --if-present || true
DB_SCHEMA=prestamos npm run seed:dev --workspace=ms-prestamos --if-present || true

echo "[init] Listo"
