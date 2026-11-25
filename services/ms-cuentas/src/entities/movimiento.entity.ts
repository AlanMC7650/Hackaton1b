import { numericTransformer, OrigenMovimiento, TipoMovimiento } from '@chuno/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Cuenta } from './cuenta.entity';

@Entity()
@Unique('uq_movimiento_referencia', ['cuentaId', 'tipo', 'referencia'])
@Index('idx_movimiento_extracto', ['cuentaId', 'createdAt'])
@Check('ck_movimiento_monto', '"monto" > 0')
export class Movimiento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  cuentaId!: string;

  @ManyToOne(() => Cuenta, { nullable: false })
  @JoinColumn({ name: 'cuenta_id', foreignKeyConstraintName: 'fk_movimiento_cuenta' })
  cuenta!: Cuenta;

  @Column({ type: 'enum', enum: TipoMovimiento })
  tipo!: TipoMovimiento;

  @Column({ type: 'enum', enum: OrigenMovimiento })
  origen!: OrigenMovimiento;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  monto!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  saldoResultante!: number;

  @Column({ type: 'uuid' })
  referencia!: string;

  @Column({ type: 'varchar', length: 150 })
  glosa!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
