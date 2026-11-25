import type { Request, Response } from 'express';
import { getIdentity } from '@chuno/shared';
import type { ActualizarPrestamoDto, CrearPrestamoDto, SimularDto } from '../schemas/prestamo.schema';
import { prestamoService } from '../services/prestamo.service';

/** Solo traduce HTTP ↔ DTO; las reglas viven en el service. */
export const prestamoController = {
  simular(req: Request, res: Response): void {
    res.json(prestamoService.simular(req.body as SimularDto));
  },

  async crear(req: Request, res: Response): Promise<void> {
    res.status(201).json(await prestamoService.crear(getIdentity(req), req.body as CrearPrestamoDto));
  },

  async listar(req: Request, res: Response): Promise<void> {
    const clienteId = typeof req.query.clienteId === 'string' ? req.query.clienteId : undefined;
    res.json(await prestamoService.listar(getIdentity(req), clienteId));
  },

  async obtener(req: Request, res: Response): Promise<void> {
    res.json(await prestamoService.obtener(getIdentity(req), req.params.id));
  },

  async actualizar(req: Request, res: Response): Promise<void> {
    res.json(await prestamoService.actualizar(getIdentity(req), req.params.id, req.body as ActualizarPrestamoDto));
  },

  async aprobar(req: Request, res: Response): Promise<void> {
    res.json(await prestamoService.aprobar(getIdentity(req), req.params.id));
  },

  async rechazar(req: Request, res: Response): Promise<void> {
    res.json(await prestamoService.rechazar(getIdentity(req), req.params.id));
  },

  async cancelar(req: Request, res: Response): Promise<void> {
    res.json(await prestamoService.cancelar(getIdentity(req), req.params.id));
  },
};
