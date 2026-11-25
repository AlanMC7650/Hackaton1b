import bcrypt from 'bcryptjs';
import { AppError, EstadoCliente, type ClienteInterno } from '@chuno/shared';
import type { Cliente } from '../entities/cliente.entity';
import { ClienteRepository } from '../repositories/cliente.repository';
import type { CreateClienteInput, UpdateClienteInput } from '../schemas/cliente.schema';

export type ClientePublico = Omit<Cliente, 'passwordHash'>;

function toPublic(cliente: Cliente): ClientePublico {
  const { passwordHash: _passwordHash, ...rest } = cliente;
  return rest;
}

export class ClienteService {
  constructor(private readonly repo = new ClienteRepository()) {}

  async create(input: CreateClienteInput): Promise<ClientePublico> {
    const existingCi = await this.repo.findByCi(input.ci);
    if (existingCi) {
      throw AppError.conflict('Ya existe un cliente registrado con ese CI');
    }

    const existingEmail = await this.repo.findByEmail(input.email);
    if (existingEmail) {
      throw AppError.conflict('Ya existe un cliente registrado con ese correo');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const created = await this.repo.createAndSave({
      ci: input.ci,
      nombres: input.nombres,
      apellidos: input.apellidos,
      email: input.email,
      telefono: input.telefono ?? null,
      direccion: input.direccion ?? null,
      passwordHash,
      rol: input.rol,
      estado: EstadoCliente.ACTIVO,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });

    return toPublic(created);
  }

  async list(q?: string): Promise<ClientePublico[]> {
    const clientes = await this.repo.search(q);
    return clientes.map(toPublic);
  }

  async getById(id: string): Promise<ClientePublico> {
    const cliente = await this.repo.findById(id);
    if (!cliente) {
      throw AppError.notFound('Cliente no encontrado');
    }
    return toPublic(cliente);
  }

  async update(id: string, input: UpdateClienteInput): Promise<ClientePublico> {
    const cliente = await this.repo.findById(id);
    if (!cliente) {
      throw AppError.notFound('Cliente no encontrado');
    }

    if (input.email && input.email !== cliente.email) {
      const emailTaken = await this.repo.findByEmail(input.email);
      if (emailTaken && emailTaken.id !== id) {
        throw AppError.conflict('El correo ya está registrado por otro cliente');
      }
      cliente.email = input.email;
    }

    if (input.telefono !== undefined) {
      cliente.telefono = input.telefono;
    }
    if (input.direccion !== undefined) {
      cliente.direccion = input.direccion;
    }

    const saved = await this.repo.save(cliente);
    return toPublic(saved);
  }

  async deactivate(id: string): Promise<ClientePublico> {
    const cliente = await this.repo.findById(id);
    if (!cliente) {
      throw AppError.notFound('Cliente no encontrado');
    }

    cliente.estado = EstadoCliente.BAJA;
    const saved = await this.repo.save(cliente);
    return toPublic(saved);
  }

  async getInternalById(id: string): Promise<ClienteInterno> {
    const cliente = await this.repo.findById(id);
    if (!cliente) {
      throw AppError.notFound('Cliente no encontrado');
    }

    return {
      id: cliente.id,
      nombreCompleto: `${cliente.nombres} ${cliente.apellidos}`.trim(),
      estado: cliente.estado,
    };
  }
}
