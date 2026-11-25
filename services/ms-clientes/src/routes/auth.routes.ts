import { Router } from 'express';
import { asyncHandler } from '@chuno/shared';
import { AuthController } from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { loginSchema } from '../schemas/cliente.schema';

const router = Router();
const controller = new AuthController();

router.post('/login', validateBody(loginSchema), asyncHandler(controller.login));

export const authRouter = router;
