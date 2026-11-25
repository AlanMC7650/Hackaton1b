import { TipoMovimiento } from '@chuno/shared';
import { Router } from 'express';
import { createCuentasController } from '../controllers/cuentas.controller';

export function createInternalCuentasRouter() {
  const router = Router();
  const controller = createCuentasController();
  router.get('/cuentas/numero/:numero', controller.buscarPorNumero);
  router.get('/cuentas/:id', controller.buscarInterna);
  router.post('/cuentas/:id/debitar', controller.moverInterna(TipoMovimiento.DEBITO));
  router.post('/cuentas/:id/acreditar', controller.moverInterna(TipoMovimiento.CREDITO));
  router.post('/transferir', controller.transferir);
  return router;
}
