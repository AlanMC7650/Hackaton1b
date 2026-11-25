import { EstadoCuenta, OrigenMovimiento, TipoMovimiento } from '@chuno/shared';
import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { TipoCuenta } from '../entities/cuenta.entity';

export class CreateCuentas1795560000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      schema: 'cuentas',
      name: 'cuenta',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'numero', type: 'varchar', length: '10' },
        { name: 'cliente_id', type: 'uuid' },
        { name: 'alias', type: 'varchar', length: '50', isNullable: true },
        { name: 'tipo', type: 'enum', enum: Object.values(TipoCuenta), default: "'AHORRO'" },
        { name: 'moneda', type: 'varchar', length: '3', default: "'BOB'" },
        { name: 'saldo', type: 'numeric', precision: 14, scale: 2, default: 0 },
        { name: 'estado', type: 'enum', enum: Object.values(EstadoCuenta), default: "'ACTIVA'" },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', default: 'now()' },
      ],
      uniques: [{ name: 'uq_cuenta_numero', columnNames: ['numero'] }],
      checks: [{ name: 'ck_cuenta_saldo', expression: '"saldo" >= 0' }],
      indices: [{ name: 'idx_cuenta_cliente', columnNames: ['cliente_id'] }],
    }));

    await queryRunner.createTable(new Table({
      schema: 'cuentas',
      name: 'movimiento',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'cuenta_id', type: 'uuid' },
        { name: 'tipo', type: 'enum', enum: Object.values(TipoMovimiento) },
        { name: 'origen', type: 'enum', enum: Object.values(OrigenMovimiento) },
        { name: 'monto', type: 'numeric', precision: 14, scale: 2 },
        { name: 'saldo_resultante', type: 'numeric', precision: 14, scale: 2 },
        { name: 'referencia', type: 'uuid' },
        { name: 'glosa', type: 'varchar', length: '150' },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
      ],
      uniques: [{ name: 'uq_movimiento_referencia', columnNames: ['cuenta_id', 'tipo', 'referencia'] }],
      checks: [{ name: 'ck_movimiento_monto', expression: '"monto" > 0' }],
      indices: [{ name: 'idx_movimiento_extracto', columnNames: ['cuenta_id', 'created_at'] }],
      foreignKeys: [{
        name: 'fk_movimiento_cuenta',
        columnNames: ['cuenta_id'],
        referencedTableName: 'cuenta',
        referencedSchema: 'cuentas',
        referencedColumnNames: ['id'],
      }],
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('cuentas.movimiento');
    await queryRunner.dropTable('cuentas.cuenta');
  }
}
