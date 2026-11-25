import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import type { LoginInput } from '../schemas/cliente.schema';

export class AuthController {
  constructor(private readonly service = new AuthService()) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.login(req.body as LoginInput);
    res.status(200).json(result);
  };
}
