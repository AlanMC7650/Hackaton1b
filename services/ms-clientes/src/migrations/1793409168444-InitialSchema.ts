import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1793409168444 implements MigrationInterface {
  name = 'InitialSchema1793409168444';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "clientes"."rol_cliente" AS ENUM('ADMIN', 'CLIENTE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "clientes"."estado_cliente" AS ENUM('ACTIVO', 'BAJA')`,
    );
    await queryRunner.query(
      `CREATE TABLE "clientes"."cliente" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ci" character varying(15) NOT NULL,
        "nombres" character varying(100) NOT NULL,
        "apellidos" character varying(100) NOT NULL,
        "email" character varying(150) NOT NULL,
        "telefono" character varying(20),
        "direccion" character varying(200),
        "password_hash" character varying(100) NOT NULL,
        "rol" "clientes"."rol_cliente" NOT NULL DEFAULT 'CLIENTE',
        "estado" "clientes"."estado_cliente" NOT NULL DEFAULT 'ACTIVO',
        "intentos_fallidos" smallint NOT NULL DEFAULT '0',
        "bloqueado_hasta" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_cliente_ci" UNIQUE ("ci"),
        CONSTRAINT "UQ_cliente_email" UNIQUE ("email"),
        CONSTRAINT "PK_cliente_id" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "clientes"."cliente"`);
    await queryRunner.query(`DROP TYPE "clientes"."estado_cliente"`);
    await queryRunner.query(`DROP TYPE "clientes"."rol_cliente"`);
  }
}
