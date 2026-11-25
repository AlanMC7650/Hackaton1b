import type { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { EmpresaEntity } from '../entities/empresa.entity';

export class EmpresaRepository {
  private get repo(): Repository<EmpresaEntity> {
    return AppDataSource.getRepository(EmpresaEntity);
  }

  async findActivas(): Promise<EmpresaEntity[]> {
    return this.repo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async findByCodigo(codigo: string): Promise<EmpresaEntity | null> {
    return this.repo.findOne({
      where: { codigo: codigo.trim().toUpperCase(), activo: true },
    });
  }
}
