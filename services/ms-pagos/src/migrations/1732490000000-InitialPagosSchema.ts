import {
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';

export class InitialPagosSchema1732490000000 implements MigrationInterface {
  name = 'InitialPagosSchema1732490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        schema: 'pagos',
        name: 'empresa',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'codigo',
            type: 'varchar',
            length: '20',
            isUnique: true,
          },
          {
            name: 'nombre',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'tipo',
            type: 'enum',
            enum: ['LUZ', 'AGUA', 'TELEFONO', 'GAS', 'OTRO'],
            enumName: 'tipo_empresa_enum',
          },
          {
            name: 'activo',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        schema: 'pagos',
        name: 'pago',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'referencia',
            type: 'uuid',
            isUnique: true,
          },
          {
            name: 'cliente_id',
            type: 'uuid',
          },
          {
            name: 'cuenta_id',
            type: 'uuid',
          },
          {
            name: 'empresa_id',
            type: 'uuid',
          },
          {
            name: 'codigo_cliente_servicio',
            type: 'varchar',
            length: '30',
          },
          {
            name: 'periodo',
            type: 'varchar',
            length: '7',
          },
          {
            name: 'monto',
            type: 'numeric',
            precision: 14,
            scale: 2,
          },
          {
            name: 'estado',
            type: 'enum',
            enum: ['PENDIENTE', 'COMPLETADO', 'RECHAZADO', 'REVERTIDO'],
            enumName: 'estado_pago_enum',
          },
          {
            name: 'comprobante',
            type: 'varchar',
            length: '40',
            isNullable: true,
          },
          {
            name: 'motivo',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        checks: [
          new TableCheck({
            name: 'ck_pago_monto',
            expression: '"monto" > 0',
          }),
        ],
      }),
      true,
    );

    await queryRunner.createIndices('pagos.pago', [
      new TableIndex({
        name: 'idx_pago_cliente_id',
        columnNames: ['cliente_id'],
      }),
      new TableIndex({
        name: 'idx_pago_cuenta_id',
        columnNames: ['cuenta_id'],
      }),
    ]);

    await queryRunner.createForeignKey(
      'pagos.pago',
      new TableForeignKey({
        name: 'fk_pago_empresa',
        columnNames: ['empresa_id'],
        referencedTableName: 'pagos.empresa',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('pagos.pago', true);
    await queryRunner.dropTable('pagos.empresa', true);
  }
}
