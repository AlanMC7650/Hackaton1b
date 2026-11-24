import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HEADERS } from './contracts';
import type { RolCliente } from './enums';
import { AppError } from './errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Identity {
  userId: string | null;
  rol: RolCliente | null;
}

/**
 * Propaga un request-id por petición. Si el cliente manda uno que no es UUID,
 * se descarta y se genera uno nuevo.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADERS.requestId);
  const id = incoming && UUID_RE.test(incoming) ? incoming : randomUUID();

  res.locals.requestId = id;
  res.setHeader(HEADERS.requestId, id);
  next();
}

/** Lee la identidad que el gateway dejó en las cabeceras. */
export function getIdentity(req: Request): Identity {
  const rol = req.header(HEADERS.userRole) ?? null;
  return {
    userId: req.header(HEADERS.userId) ?? null,
    rol: rol === null ? null : (rol as RolCliente),
  };
}

/** Restringe una ruta a uno o más roles. Requiere que el gateway haya validado el JWT. */
export function requireRole(...roles: RolCliente[]): RequestHandler {
  return (req, _res, next) => {
    const { rol } = getIdentity(req);

    if (!rol) {
      next(AppError.unauthorized('Falta la identidad del usuario'));
      return;
    }
    if (!roles.includes(rol)) {
      next(AppError.forbidden('El rol no tiene permiso para esta operación'));
      return;
    }

    next();
  };
}

/**
 * Permite el acceso si el usuario tiene uno de los roles indicados o si el
 * cliente autenticado es el dueño del recurso.
 */
export function requireSelfOrRole(
  roles: RolCliente[],
  getClienteId: (req: Request) => string | undefined,
): RequestHandler {
  return (req, _res, next) => {
    const { userId, rol } = getIdentity(req);

    if (rol && roles.includes(rol)) {
      next();
      return;
    }

    const objetivo = getClienteId(req);
    if (userId && objetivo && userId === objetivo) {
      next();
      return;
    }

    next(AppError.forbidden('No puede acceder a datos de otro cliente'));
  };
}
