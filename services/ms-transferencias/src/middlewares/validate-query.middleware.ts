import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '@chuno/shared';

/** Valida req.query con Zod y deja el resultado tipado en res.locals.query. */
export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(AppError.badRequest('Parámetros inválidos', result.error.issues));
      return;
    }

    res.locals.query = result.data;
    next();
  };
}
