import { OrigenMovimiento, TipoMovimiento } from '@chuno/shared';
import { Router } from 'express';
import { createCuentasController } from '../controllers/cuentas.controller';

export function createCuentasRouter() {
  const router = Router();
  const controller = createCuentasController();
  router.post('/', controller.abrir);
  router.get('/', controller.listar);
  router.get('/:id', controller.detalle);
  router.patch('/:id', controller.editarAlias);
  router.delete('/:id', controller.cerrar);
  router.post('/:id/depositos', controller.operar(TipoMovimiento.CREDITO, OrigenMovimiento.DEPOSITO));
  router.post('/:id/retiros', controller.operar(TipoMovimiento.DEBITO, OrigenMovimiento.RETIRO));
  router.get('/:id/movimientos', controller.extracto);
  return router;
}
