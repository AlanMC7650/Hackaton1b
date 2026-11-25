import type { Repository } from 'typeorm';
import type { EstadoPago } from '@chuno/shared';
import { AppDataSource } from '../data-source';
import { PagoEntity } from '../entities/pago.entity';

export interface CrearPagoRecord {
  referencia: string;
  clienteId: string;
  cuentaId: string;
  empresaId: string;
  codigoClienteServicio: string;
  periodo: string;
  monto: number;
  estado: EstadoPago;
}

export class PagoRepository {
  private get repo(): Repository<PagoEntity> {
    return AppDataSource.getRepository(PagoEntity);
  }

  async create(data: CrearPagoRecord): Promise<PagoEntity> {
    const entity = this.repo.create({
      ...data,
      comprobante: null,
      motivo: null,
    });
    const saved = await this.repo.save(entity);
    return (await this.findById(saved.id)) ?? saved;
  }

  async updateEstado(
    id: string,
    estado: EstadoPago,
    patch: { comprobante?: string | null; motivo?: string | null } = {},
  ): Promise<PagoEntity> {
    await this.repo.update(
      { id },
      {
        estado,
        ...(patch.comprobante !== undefined ? { comprobante: patch.comprobante } : {}),
        ...(patch.motivo !== undefined ? { motivo: patch.motivo } : {}),
      },
    );
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Pago ${id} no encontrado luego de actualizar`);
    }
    return updated;
  }

  async findById(id: string): Promise<PagoEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: { empresa: true },
    });
  }

  async findByClienteId(clienteId: string): Promise<PagoEntity[]> {
    return this.repo.find({
      where: { clienteId },
      relations: { empresa: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<PagoEntity[]> {
    return this.repo.find({
      relations: { empresa: true },
      order: { createdAt: 'DESC' },
    });
  }
}
