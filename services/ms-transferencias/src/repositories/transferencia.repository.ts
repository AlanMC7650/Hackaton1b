import { QueryFailedError, type Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Transferencia } from '../entities/transferencia.entity';

export type NuevaTransferencia = Omit<Transferencia, 'id' | 'createdAt'>;

const UNIQUE_VIOLATION = '23505';

/** Único lugar del servicio que usa TypeORM. */
export class TransferenciaRepository {
  // Se pide al usarse: el DataSource se inicializa después de importar el módulo.
  private get repo(): Repository<Transferencia> {
    return AppDataSource.getRepository(Transferencia);
  }

  findByReferencia(referencia: string): Promise<Transferencia | null> {
    return this.repo.findOne({ where: { referencia } });
  }

  /**
   * Guarda la transferencia. Si otra petición con la misma referencia llegó primero
   * (violación de la unicidad), devuelve la ya guardada en lugar de fallar.
   */
  async crear(datos: NuevaTransferencia): Promise<Transferencia> {
    try {
      return await this.repo.save(this.repo.create(datos));
    } catch (error) {
      const code = error instanceof QueryFailedError ? (error.driverError as { code?: string })?.code : undefined;
      if (code === UNIQUE_VIOLATION) {
        const existente = await this.findByReferencia(datos.referencia);
        if (existente) return existente;
      }
      throw error;
    }
  }

  findByCliente(clienteId: string, limit: number): Promise<Transferencia[]> {
    return this.repo.find({ where: { clienteId }, order: { createdAt: 'DESC' }, take: limit });
  }

  findAll(limit: number, clienteId?: string): Promise<Transferencia[]> {
    return this.repo.find({
      where: clienteId ? { clienteId } : {},
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

export const transferenciaRepository = new TransferenciaRepository();
