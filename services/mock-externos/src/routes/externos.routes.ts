import { Router } from 'express';
import { AppError, asyncHandler } from '@chuno/shared';
import {
  confirmarPago,
  consultarDeuda,
  listarBancos,
  listarEmpresas,
  procesarTransferenciaAch,
  simulateExternalLatency,
} from '../services/externos.service';

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw AppError.badRequest(`El campo '${field}' es obligatorio`);
  }
  return value.trim();
}

function requirePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw AppError.badRequest(`El campo '${field}' debe ser un número mayor a 0`);
  }
  return value;
}

export function createEmpresasRouter(): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      await simulateExternalLatency();
      res.status(200).json(listarEmpresas());
    }),
  );

  router.get(
    '/:codigo/deudas/:codigoCliente',
    asyncHandler(async (req, res) => {
      await simulateExternalLatency();
      const deuda = consultarDeuda(req.params.codigo, req.params.codigoCliente);
      res.status(200).json(deuda);
    }),
  );

  router.post(
    '/:codigo/pagos',
    asyncHandler(async (req, res) => {
      await simulateExternalLatency();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const codigoCliente = requireNonEmptyString(body.codigoCliente, 'codigoCliente');
      const referencia = requireNonEmptyString(body.referencia, 'referencia');
      const monto = requirePositiveNumber(body.monto, 'monto');

      const resultado = confirmarPago(req.params.codigo, { codigoCliente, monto, referencia });
      res.status(200).json(resultado);
    }),
  );

  return router;
}

export function createAchRouter(): Router {
  const router = Router();

  router.get(
    '/bancos',
    asyncHandler(async (_req, res) => {
      await simulateExternalLatency();
      res.status(200).json(listarBancos());
    }),
  );

  router.post(
    '/transferencias',
    asyncHandler(async (req, res) => {
      await simulateExternalLatency();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const bancoDestino = requireNonEmptyString(body.bancoDestino, 'bancoDestino');
      const cuentaDestino = requireNonEmptyString(body.cuentaDestino, 'cuentaDestino');
      const titular = requireNonEmptyString(body.titular, 'titular');
      const referencia = requireNonEmptyString(body.referencia, 'referencia');
      const monto = requirePositiveNumber(body.monto, 'monto');

      const resultado = procesarTransferenciaAch({
        bancoDestino,
        cuentaDestino,
        titular,
        monto,
        referencia,
      });
      res.status(200).json(resultado);
    }),
  );

  return router;
}
