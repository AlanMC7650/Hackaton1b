import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './errors';

type Origen = 'body' | 'query' | 'params';

/**
 * Middleware Zod común. Valida req[origen] y deja el resultado tipado.
 * Si falla responde 400 con { code: 'VALIDATION_ERROR', message, details: issues }.
 *
 * Uso: router.post('/', validate(miSchema), controller.crear)
 */
export function validate<T>(schema: ZodType<T>, origen: Origen = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[origen]);
    if (!result.success) {
      next(AppError.badRequest('Datos inválidos', result.error.issues));
      return;
    }
    if (origen === 'body') req.body = result.data;
    else Object.assign(req[origen], result.data);
    next();
  };
}
