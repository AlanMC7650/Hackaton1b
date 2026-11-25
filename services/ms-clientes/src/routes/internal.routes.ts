import { Router } from 'express';
import { asyncHandler } from '@chuno/shared';
import { ClienteController } from '../controllers/cliente.controller';

const router = Router();
const controller = new ClienteController();

router.get('/clientes/:id', asyncHandler(controller.getInternalById));

export const internalClienteRouter = router;
