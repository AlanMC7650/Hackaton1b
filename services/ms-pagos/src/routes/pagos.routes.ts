import { Router } from 'express';
import { asyncHandler } from '@chuno/shared';
import { PagosController } from '../controllers/pagos.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { crearPagoSchema } from '../schemas/pago.schema';

export function createPagosRouter(controller = new PagosController()): Router {
  const router = Router();

  router.get('/empresas', asyncHandler(controller.listarEmpresas));
  router.get('/deuda', asyncHandler(controller.consultarDeuda));
  router.get('/', asyncHandler(controller.listarPagos));
  router.get('/:id', asyncHandler(controller.obtenerPago));
  router.post('/', validateBody(crearPagoSchema), asyncHandler(controller.pagar));

  return router;
}
