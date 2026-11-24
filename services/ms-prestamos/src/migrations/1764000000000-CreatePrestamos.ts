import { type MigrationInterface, type QueryRunner, Table, TableCheck, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

const SCHEMA = 'prestamos';

/** HU-11: tablas prestamo y cuota, construidas con la API de TypeORM (sin SQL crudo). */
export class CreatePrestamos1764000000000 implements MigrationInterface {
  name = 'CreatePrestamos1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        schema: SCHEMA,
        name: 'prestamo',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'cliente_id', type: 'uuid' },
          { name: 'cuenta_desembolso_id', type: 'uuid' },
          { name: 'cuenta_desembolso_numero', type: 'varchar', length: '10' },
          { name: 'monto', type: 'numeric', precision: 14, scale: 2 },
          { name: 'tasa_anual', type: 'numeric', precision: 5, scale: 2 },
          { name: 'plazo_meses', type: 'smallint' },
          { name: 'cuota_mensual', type: 'numeric', precision: 14, scale: 2 },
          {
            name: 'estado',
            type: 'enum',
            enum: ['SOLICITADO', 'APROBADO', 'RECHAZADO', 'CANCELADO'],
            enumName: 'estado_prestamo',
            default: `'SOLICITADO'`,
          },
          { name: 'referencia_desembolso', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
        checks: [
          new TableCheck({ name: 'ck_prestamo_monto', expression: '"monto" > 0' }),
          new TableCheck({ name: 'ck_prestamo_plazo', expression: '"plazo_meses" BETWEEN 1 AND 60' }),
          new TableCheck({ name: 'ck_prestamo_tasa', expression: '"tasa_anual" >= 0' }),
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      `${SCHEMA}.prestamo`,
      new TableIndex({ name: 'ix_prestamo_cliente', columnNames: ['cliente_id'] }),
    );

    await queryRunner.createTable(
      new Table({
        schema: SCHEMA,
        name: 'cuota',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'prestamo_id', type: 'uuid' },
          { name: 'numero', type: 'smallint' },
          { name: 'fecha_vencimiento', type: 'date' },
          { name: 'capital', type: 'numeric', precision: 14, scale: 2 },
          { name: 'interes', type: 'numeric', precision: 14, scale: 2 },
          { name: 'cuota', type: 'numeric', precision: 14, scale: 2 },
          { name: 'saldo', type: 'numeric', precision: 14, scale: 2 },
        ],
        uniques: [new TableUnique({ name: 'uq_cuota_prestamo_numero', columnNames: ['prestamo_id', 'numero'] })],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      `${SCHEMA}.cuota`,
      new TableForeignKey({
        name: 'fk_cuota_prestamo',
        columnNames: ['prestamo_id'],
        referencedSchema: SCHEMA,
        referencedTableName: 'prestamo',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(`${SCHEMA}.cuota`, true, true, true);
    await queryRunner.dropTable(`${SCHEMA}.prestamo`, true, true, true);
  }
}
