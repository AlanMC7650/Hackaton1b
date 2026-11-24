import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError, EstadoCliente, requireEnv } from '@chuno/shared';
import type { JwtPayload } from '@chuno/shared';
import { ClienteRepository } from '../repositories/cliente.repository';
import type { LoginInput } from '../schemas/cliente.schema';

const MAX_INTENTOS_FALLIDOS = 3;
const BLOQUEO_MINUTOS = 5;

export interface LoginResult {
  token: string;
  usuario: {
    id: string;
    email: string;
    rol: string;
    nombreCompleto: string;
  };
}

export class AuthService {
  constructor(private readonly repo = new ClienteRepository()) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const { JWT_SECRET } = requireEnv('JWT_SECRET');
    const cliente = await this.repo.findByEmail(input.email, true);

    if (!cliente) {
      throw AppError.unauthorized('Credenciales inválidas');
    }

    if (cliente.estado === EstadoCliente.BAJA) {
      throw AppError.unauthorized('Credenciales inválidas');
    }

    const ahora = new Date();
    if (cliente.bloqueadoHasta && cliente.bloqueadoHasta > ahora) {
      throw AppError.unauthorized('Cuenta bloqueada temporalmente por intentos fallidos. Intenta en unos minutos.');
    }

    const passwordValido = await bcrypt.compare(input.password, cliente.passwordHash);
    if (!passwordValido) {
      const nuevosIntentos = (cliente.intentosFallidos ?? 0) + 1;
      if (nuevosIntentos >= MAX_INTENTOS_FALLIDOS) {
        cliente.intentosFallidos = 0;
        cliente.bloqueadoHasta = new Date(ahora.getTime() + BLOQUEO_MINUTOS * 60 * 1000);
      } else {
        cliente.intentosFallidos = nuevosIntentos;
      }
      await this.repo.save(cliente);
      throw AppError.unauthorized('Credenciales inválidas');
    }

    if (cliente.intentosFallidos !== 0 || cliente.bloqueadoHasta !== null) {
      cliente.intentosFallidos = 0;
      cliente.bloqueadoHasta = null;
      await this.repo.save(cliente);
    }

    const payload: JwtPayload = {
      sub: cliente.id,
      rol: cliente.rol,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '2h',
    });

    return {
      token,
      usuario: {
        id: cliente.id,
        email: cliente.email,
        rol: cliente.rol,
        nombreCompleto: `${cliente.nombres} ${cliente.apellidos}`.trim(),
      },
    };
  }
}
