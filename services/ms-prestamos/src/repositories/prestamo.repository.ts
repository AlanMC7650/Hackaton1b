import { AppDataSource } from '../data-source';
import { Cuota } from '../entities/cuota.entity';
import { Prestamo } from '../entities/prestamo.entity';

/** Único lugar del servicio que usa TypeORM. */
const prestamos = () => AppDataSource.getRepository(Prestamo);

export const prestamoRepository = {
  async listar(clienteId?: string): Promise<Prestamo[]> {
    return prestamos().find({
      where: clienteId ? { clienteId } : {},
      order: { createdAt: 'DESC' },
    });
  },

  async buscarPorId(id: string): Promise<Prestamo | null> {
    return prestamos().findOne({ where: { id } });
  },

  async buscarConCuotas(id: string): Promise<Prestamo | null> {
    return prestamos().findOne({
      where: { id },
      relations: { cuotas: true },
      order: { cuotas: { numero: 'ASC' } },
    });
  },

  /** Crea el préstamo y su plan de cuotas en una sola transacción. */
  async crearConCuotas(datos: Partial<Prestamo>, cuotas: Partial<Cuota>[]): Promise<Prestamo> {
    return AppDataSource.transaction(async (manager) => {
      const prestamo = await manager.save(Prestamo, manager.create(Prestamo, datos));
      await manager.save(
        Cuota,
        cuotas.map((cuota) => manager.create(Cuota, { ...cuota, prestamoId: prestamo.id })),
      );
      return prestamo;
    });
  },

  /** Actualiza el préstamo y reemplaza su plan de cuotas en una sola transacción. */
  async actualizarConCuotas(id: string, cambios: Partial<Prestamo>, cuotas: Partial<Cuota>[]): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      await manager.update(Prestamo, { id }, cambios);
      await manager.delete(Cuota, { prestamoId: id });
      await manager.save(
        Cuota,
        cuotas.map((cuota) => manager.create(Cuota, { ...cuota, prestamoId: id })),
      );
    });
  },

  async actualizar(id: string, cambios: Partial<Prestamo>): Promise<void> {
    await prestamos().update({ id }, cambios);
  },
};
