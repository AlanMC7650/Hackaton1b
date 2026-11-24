import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, HEADERS, requireEnv } from '@chuno/shared';
import type { JwtPayload as ChunoJwtPayload } from '@chuno/shared';

const RUTAS_PUBLICAS = ['/api/clientes/auth/login'];

/**
 * Valida el JWT en todas las rutas /api salvo el login y propaga
 * la identidad en cabeceras X-User-Id y X-User-Rol.
 */
export function jwtAuth(): RequestHandler {
  const { JWT_SECRET } = requireEnv('JWT_SECRET');

  return (req, _res, next) => {
    const path = req.path.replace(/\/+$/, '');

    if (!path.startsWith('/api') || RUTAS_PUBLICAS.includes(path)) {
      next();
      return;
    }

    const header = req.header('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      next(AppError.unauthorized('Falta el token de acceso'));
      return;
    }

    try {
      const payload = jwt.verify(header.slice(7).trim(), JWT_SECRET, {
        algorithms: ['HS256'],
      }) as ChunoJwtPayload;

      if (!payload.sub || !payload.rol) {
        next(AppError.unauthorized('Token inválido'));
        return;
      }

      req.headers[HEADERS.userId] = payload.sub;
      req.headers[HEADERS.userRole] = payload.rol;
      next();
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        next(AppError.unauthorized('La sesión expiró'));
        return;
      }

      next(AppError.unauthorized('Token inválido'));
    }
  };
}
