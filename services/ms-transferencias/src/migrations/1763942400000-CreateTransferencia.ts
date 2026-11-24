import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTransferencia1763942400000 implements MigrationInterface {
  name = 'CreateTransferencia1763942400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'transferencia',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'referencia', type: 'uuid', isNullable: false },
          { name: 'cliente_id', type: 'uuid', isNullable: false },
          {
            name: 'tipo',
            type: 'enum',
            enum: ['PROPIA', 'TERCERO', 'INTERBANCARIA'],
            enumName: 'transferencia_tipo_enum',
            isNullable: false,
          },
          { name: 'cuenta_origen_id', type: 'uuid', isNullable: false },
          { name: 'cuenta_destino_id', type: 'uuid', isNullable: true },
          { name: 'cuenta_destino_numero', type: 'varchar', length: '30', isNullable: false },
          { name: 'banco_destino', type: 'varchar', length: '50', isNullable: false },
          { name: 'titular_destino', type: 'varchar', length: '150', isNullable: true },
          { name: 'monto', type: 'numeric', precision: 14, scale: 2, isNullable: false },
          { name: 'glosa', type: 'varchar', length: '150', isNullable: false },
          {
            name: 'estado',
            type: 'enum',
            enum: ['COMPLETADA', 'RECHAZADA', 'REVERTIDA'],
            enumName: 'transferencia_estado_enum',
            isNullable: false,
          },
          { name: 'codigo_externo', type: 'varchar', length: '40', isNullable: true },
          { name: 'motivo', type: 'varchar', length: '200', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
        checks: [{ name: 'ck_transferencia_monto', expression: '"monto" > 0 AND "monto" <= 50000' }],
      }),
    );

    await queryRunner.createIndex(
      'transferencia',
      new TableIndex({ name: 'uq_transferencia_referencia', columnNames: ['referencia'], isUnique: true }),
    );
    await queryRunner.createIndex(
      'transferencia',
      new TableIndex({ name: 'ix_transferencia_cliente_id', columnNames: ['cliente_id'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('transferencia', 'ix_transferencia_cliente_id');
    await queryRunner.dropIndex('transferencia', 'uq_transferencia_referencia');
    await queryRunner.dropTable('transferencia');
  }
}
