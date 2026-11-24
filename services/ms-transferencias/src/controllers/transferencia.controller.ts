import { asyncHandler, getIdentity } from '@chuno/shared';
import { transferenciaService } from '../services/transferencia.service';
import type { ListarTransferenciasQuery } from '../schemas/transferencia.schema';

/** POST /transferencias → 201 si se creó, 200 si la referencia ya existía. */
export const crearTransferencia = asyncHandler(async (req, res) => {
  const { transferencia, repetida } = await transferenciaService.crear(getIdentity(req), req.body);
  res.status(repetida ? 200 : 201).json(transferencia);
});

/** GET /transferencias → historial del cliente (el ADMIN ve todas). */
export const listarTransferencias = asyncHandler(async (req, res) => {
  const query = res.locals.query as ListarTransferenciasQuery;
  res.json(await transferenciaService.listar(getIdentity(req), query));
});

/** GET /transferencias/bancos → lista que entrega el intermediario interbancario. */
export const listarBancos = asyncHandler(async (_req, res) => {
  res.json(await transferenciaService.listarBancos());
});
