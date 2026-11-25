import { Router } from 'express';
import { asyncHandler, requireRole, RolCliente } from '@chuno/shared';
import { ClienteController } from '../controllers/cliente.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { createClienteSchema, updateClienteSchema } from '../schemas/cliente.schema';

const router = Router();
const controller = new ClienteController();

router.get('/me', requireRole(RolCliente.ADMIN, RolCliente.CLIENTE), asyncHandler(controller.me));
router.post('/', requireRole(RolCliente.ADMIN), validateBody(createClienteSchema), asyncHandler(controller.create));
router.get('/', requireRole(RolCliente.ADMIN), asyncHandler(controller.list));
router.get('/:id', requireRole(RolCliente.ADMIN), asyncHandler(controller.getById));
router.patch('/:id', requireRole(RolCliente.ADMIN), validateBody(updateClienteSchema), asyncHandler(controller.update));
router.delete('/:id', requireRole(RolCliente.ADMIN), asyncHandler(controller.deactivate));

export const clienteRouter = router;
