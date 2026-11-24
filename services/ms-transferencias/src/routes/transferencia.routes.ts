import { Router } from 'express';
import { RolCliente, requireRole } from '@chuno/shared';
import {
  crearTransferencia,
  listarBancos,
  listarTransferencias,
} from '../controllers/transferencia.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { validateQuery } from '../middlewares/validate-query.middleware';
import { crearTransferenciaSchema, listarTransferenciasSchema } from '../schemas/transferencia.schema';

export function createTransferenciaRouter(): Router {
  const router = Router();

  router.get('/bancos', requireRole(RolCliente.CLIENTE, RolCliente.ADMIN), listarBancos);
  router.get(
    '/',
    requireRole(RolCliente.CLIENTE, RolCliente.ADMIN),
    validateQuery(listarTransferenciasSchema),
    listarTransferencias,
  );
  // Solo un CLIENTE opera: la cuenta de origen debe ser suya.
  router.post('/', requireRole(RolCliente.CLIENTE), validateBody(crearTransferenciaSchema), crearTransferencia);

  return router;
}
