import { EstadoCuenta, numericTransformer } from '@chuno/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum TipoCuenta {
  AHORRO = 'AHORRO',
}

@Entity()
@Unique('uq_cuenta_numero', ['numero'])
@Check('ck_cuenta_saldo', '"saldo" >= 0')
export class Cuenta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  numero!: string;

  @Index('idx_cuenta_cliente')
  @Column({ type: 'uuid' })
  clienteId!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  alias!: string | null;

  @Column({ type: 'enum', enum: TipoCuenta, default: TipoCuenta.AHORRO })
  tipo!: TipoCuenta;

  @Column({ type: 'varchar', length: 3, default: 'BOB' })
  moneda!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  saldo!: number;

  @Column({ type: 'enum', enum: EstadoCuenta, default: EstadoCuenta.ACTIVA })
  estado!: EstadoCuenta;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
