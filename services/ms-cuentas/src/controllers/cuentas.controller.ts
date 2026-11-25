import { randomUUID } from 'node:crypto';
import { AppError, asyncHandler, getIdentity, OrigenMovimiento, RolCliente, TipoMovimiento } from '@chuno/shared';
import type { Request } from 'express';
import { z } from 'zod';
import * as schemas from '../schemas/cuentas.schemas';
import { CuentasService } from '../services/cuentas.service';

function leer<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw AppError.badRequest('Datos inválidos', result.error.issues);
  return result.data;
}

function usuario(req: Request) {
  const { userId, rol } = getIdentity(req);
  const id = schemas.uuid.safeParse(userId);
  if (!id.success || (rol !== RolCliente.ADMIN && rol !== RolCliente.CLIENTE)) {
    throw AppError.unauthorized('Falta una identidad válida');
  }
  return { id: id.data, rol };
}

function idCuenta(req: Request) {
  return leer(schemas.uuid, req.params.id);
}

export function createCuentasController(service = new CuentasService()) {
  return {
    abrir: asyncHandler(async (req, res) => {
      const actor = usuario(req);
      const { clienteId, alias } = leer(schemas.apertura, req.body ?? {});
      res.status(201).json(await service.abrir(actor, clienteId, alias));
    }),
    listar: asyncHandler(async (req, res) => {
      const actor = usuario(req);
      const { clienteId } = leer(schemas.filtroCuentas, req.query);
      res.json(await service.listar(actor, clienteId));
    }),
    detalle: asyncHandler(async (req, res) => {
      res.json(await service.detalle(idCuenta(req), usuario(req)));
    }),
    editarAlias: asyncHandler(async (req, res) => {
      const { alias } = leer(schemas.cambioAlias, req.body);
      res.json(await service.editarAlias(idCuenta(req), usuario(req), alias));
    }),
    cerrar: asyncHandler(async (req, res) => {
      await service.cerrar(idCuenta(req), usuario(req));
      res.sendStatus(204);
    }),
    extracto: asyncHandler(async (req, res) => {
      res.json(await service.extracto(idCuenta(req), usuario(req)));
    }),
    operar: (tipo: TipoMovimiento, origen: OrigenMovimiento) =>
      asyncHandler(async (req, res) => {
        const actor = usuario(req);
        const { monto, glosa } = leer(schemas.operacionPublica, req.body);
        const key = req.header('Idempotency-Key');
        const referencia = key === undefined ? randomUUID() : leer(schemas.uuid, key);
        res.status(201).json(
          await service.mover(
            idCuenta(req),
            tipo,
            {
              monto,
              glosa: glosa ?? (tipo === TipoMovimiento.CREDITO ? 'Depósito' : 'Retiro'),
              referencia,
              origen,
            },
            actor,
          ),
        );
      }),
    buscarInterna: asyncHandler(async (req, res) => {
      res.json(await service.buscarInterna(idCuenta(req)));
    }),
    buscarPorNumero: asyncHandler(async (req, res) => {
      res.json(await service.buscarInterna(leer(schemas.numeroCuenta, req.params.numero), true));
    }),
    moverInterna: (tipo: TipoMovimiento) =>
      asyncHandler(async (req, res) => {
        const datos = leer(schemas.operacionInterna, req.body);
        res.json(await service.mover(idCuenta(req), tipo, datos));
      }),
    transferir: asyncHandler(async (req, res) => {
      res.json(await service.transferir(leer(schemas.transferencia, req.body)));
    }),
  };
}
