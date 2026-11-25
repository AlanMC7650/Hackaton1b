import { ILike, type Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Cliente } from '../entities/cliente.entity';

export class ClienteRepository {
  private get repo(): Repository<Cliente> {
    return AppDataSource.getRepository(Cliente);
  }

  async findById(id: string): Promise<Cliente | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByCi(ci: string): Promise<Cliente | null> {
    return this.repo.findOne({ where: { ci } });
  }

  async findByEmail(email: string, withPassword = false): Promise<Cliente | null> {
    const normalized = email.trim().toLowerCase();
    if (!withPassword) {
      return this.repo.findOne({ where: { email: normalized } });
    }
    return this.repo
      .createQueryBuilder('c')
      .addSelect('c.passwordHash')
      .where('c.email = :email', { email: normalized })
      .getOne();
  }

  async search(q?: string): Promise<Cliente[]> {
    const term = q?.trim();
    if (!term) {
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    const pattern = `%${term}%`;
    return this.repo.find({
      where: [
        { ci: ILike(pattern) },
        { nombres: ILike(pattern) },
        { apellidos: ILike(pattern) },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async createAndSave(data: Partial<Cliente>): Promise<Cliente> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async save(cliente: Cliente): Promise<Cliente> {
    return this.repo.save(cliente);
  }
}
