import { AppError, OrigenMovimiento, TipoMovimiento } from '@chuno/shared';
import { randomUUID } from 'node:crypto';
import { EntityManager, QueryFailedError } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Cuenta } from '../entities/cuenta.entity';
import { Movimiento } from '../entities/movimiento.entity';

export class CuentasRepository {
  constructor(private readonly manager?: EntityManager) {}

  private get cuentas() {
    return (this.manager ?? AppDataSource.manager).getRepository(Cuenta);
  }

  private get movimientos() {
    return (this.manager ?? AppDataSource.manager).getRepository(Movimiento);
  }

  transaction<T>(operation: (repository: CuentasRepository) => Promise<T>): Promise<T> {
    return AppDataSource.transaction((manager) => operation(new CuentasRepository(manager)));
  }

  async crear(clienteId: string, numero: string, alias: string | null) {
    try {
      return await this.cuentas.save(this.cuentas.create({ clienteId, numero, alias }));
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError.constraint === 'uq_cuenta_numero') {
        return null;
      }
      throw error;
    }
  }

  listar(clienteId?: string) {
    return this.cuentas.find({
      where: clienteId ? { clienteId } : undefined,
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  async buscar(id: string, bloquear = false): Promise<Cuenta> {
    const query = this.cuentas.createQueryBuilder('cuenta').where('cuenta.id = :id', { id });
    if (bloquear) query.setLock('pessimistic_write');
    const cuenta = await query.getOne();
    if (!cuenta) throw AppError.notFound('Cuenta no encontrada');
    return cuenta;
  }

  async buscarPorNumero(numero: string): Promise<Cuenta> {
    const cuenta = await this.cuentas.findOneBy({ numero });
    if (!cuenta) throw AppError.notFound('Cuenta no encontrada');
    return cuenta;
  }

  guardar(cuenta: Cuenta) {
    return this.cuentas.save(cuenta);
  }

  extracto(cuentaId: string) {
    return this.movimientos.find({
      where: { cuentaId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  buscarMovimiento(cuentaId: string, tipo: TipoMovimiento, referencia: string) {
    return this.movimientos.findOneBy({ cuentaId, tipo, referencia });
  }

  registrarMovimiento(
    datos: Pick<Movimiento, 'cuentaId' | 'tipo' | 'origen' | 'monto' | 'saldoResultante' | 'referencia' | 'glosa'>,
  ) {
    return this.movimientos.save(this.movimientos.create({ ...datos, createdAt: new Date() }));
  }

  sembrar(clienteIds: string[]) {
    return this.transaction(async (repo) => {
      if (await repo.cuentas.count()) return;
      for (const [index, clienteId] of clienteIds.entries()) {
        const numero = String(index + 1).padStart(10, '0');
        const saldo = 500 + index * 100;
        const result = await repo.cuentas
          .createQueryBuilder()
          .insert()
          .values({ numero, clienteId, saldo, alias: 'Ahorro de prueba' })
          .orIgnore()
          .returning('id')
          .execute();
        const cuentaId: string | undefined = result.raw[0]?.id;
        if (cuentaId) {
          await repo.registrarMovimiento({
            cuentaId,
            tipo: TipoMovimiento.CREDITO,
            origen: OrigenMovimiento.DEPOSITO,
            monto: saldo,
            saldoResultante: saldo,
            referencia: randomUUID(),
            glosa: 'Saldo inicial de prueba',
          });
        }
      }
    });
  }
}
