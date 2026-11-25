import type { Request, Response } from 'express';
import { AppError, getIdentity } from '@chuno/shared';
import {
  deudaQuerySchema,
  listarPagosQuerySchema,
  pagoIdParamsSchema,
  type CrearPagoDto,
} from '../schemas/pago.schema';
import { PagoService } from '../services/pago.service';

function requireActor(req: Request) {
  const { userId, rol } = getIdentity(req);
  if (!userId || !rol) {
    throw AppError.unauthorized('Falta la identidad del usuario');
  }
  return { userId, rol };
}

export class PagosController {
  constructor(private readonly pagoService = new PagoService()) {}

  listarEmpresas = async (_req: Request, res: Response): Promise<void> => {
    const empresas = await this.pagoService.listarEmpresas();
    res.status(200).json(empresas);
  };

  consultarDeuda = async (req: Request, res: Response): Promise<void> => {
    const parsed = deudaQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.badRequest('Parámetros de consulta inválidos', parsed.error.issues);
    }

    const deuda = await this.pagoService.consultarDeuda(parsed.data.empresa, parsed.data.codigo);
    res.status(200).json(deuda);
  };

  pagar = async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const body = req.body as CrearPagoDto;
    const pago = await this.pagoService.pagar(actor, body);
    res.status(201).json(pago);
  };

  listarPagos = async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const parsed = listarPagosQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.badRequest('Parámetros de búsqueda inválidos', parsed.error.issues);
    }

    const pagos = await this.pagoService.listarPagos(actor, parsed.data.clienteId);
    res.status(200).json(pagos);
  };

  obtenerPago = async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const parsed = pagoIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      throw AppError.badRequest('Identificador de pago inválido', parsed.error.issues);
    }

    const pago = await this.pagoService.obtenerPago(actor, parsed.data.id);
    res.status(200).json(pago);
  };
}
