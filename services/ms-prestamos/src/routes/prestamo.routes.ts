import { type NextFunction, type Request, type Response, Router } from 'express';
import { AppError, asyncHandler, RolCliente, requireRole } from '@chuno/shared';
import { prestamoController } from '../controllers/prestamo.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { actualizarPrestamoSchema, crearPrestamoSchema, simularSchema } from '../schemas/prestamo.schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validarId(req: Request, _res: Response, next: NextFunction): void {
  if (!UUID_RE.test(req.params.id)) {
    next(AppError.badRequest('Identificador de préstamo inválido'));
    return;
  }
  next();
}

export function createPrestamoRouter(): Router {
  const router = Router();
  const autenticado = requireRole(RolCliente.ADMIN, RolCliente.CLIENTE);
  const soloAdmin = requireRole(RolCliente.ADMIN);

  router.use(autenticado);

  router.post('/simular', validateBody(simularSchema), prestamoController.simular);
  router.post('/', validateBody(crearPrestamoSchema), asyncHandler(prestamoController.crear));
  router.get('/', asyncHandler(prestamoController.listar));
  router.get('/:id', validarId, asyncHandler(prestamoController.obtener));
  router.patch('/:id', validarId, validateBody(actualizarPrestamoSchema), asyncHandler(prestamoController.actualizar));
  router.post('/:id/aprobar', validarId, soloAdmin, asyncHandler(prestamoController.aprobar));
  router.post('/:id/rechazar', validarId, soloAdmin, asyncHandler(prestamoController.rechazar));
  router.delete('/:id', validarId, asyncHandler(prestamoController.cancelar));

  return router;
}
