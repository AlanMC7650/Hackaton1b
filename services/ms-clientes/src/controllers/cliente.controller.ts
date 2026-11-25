import type { Request, Response } from 'express';
import { AppError, getIdentity } from '@chuno/shared';
import { ClienteService } from '../services/cliente.service';
import type { CreateClienteInput, UpdateClienteInput } from '../schemas/cliente.schema';

export class ClienteController {
  constructor(private readonly service = new ClienteService()) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const created = await this.service.create(req.body as CreateClienteInput);
    res.status(201).json(created);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const clientes = await this.service.list(q);
    res.status(200).json(clientes);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getIdentity(req);
    if (!userId) {
      throw AppError.unauthorized('Falta la identidad del usuario');
    }
    const cliente = await this.service.getById(userId);
    res.status(200).json(cliente);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const cliente = await this.service.getById(req.params.id);
    res.status(200).json(cliente);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const updated = await this.service.update(req.params.id, req.body as UpdateClienteInput);
    res.status(200).json(updated);
  };

  deactivate = async (req: Request, res: Response): Promise<void> => {
    const updated = await this.service.deactivate(req.params.id);
    res.status(200).json(updated);
  };

  getInternalById = async (req: Request, res: Response): Promise<void> => {
    const cliente = await this.service.getInternalById(req.params.id);
    res.status(200).json(cliente);
  };
}
