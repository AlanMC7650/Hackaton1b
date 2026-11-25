import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoPago, numericTransformer } from '@chuno/shared';
import { EmpresaEntity } from './empresa.entity';

@Entity({ name: 'pago', schema: 'pagos' })
@Check('ck_pago_monto', '"monto" > 0')
export class PagoEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  referencia!: string;

  @Index('idx_pago_cliente_id')
  @Column({ type: 'uuid' })
  clienteId!: string;

  @Index('idx_pago_cuenta_id')
  @Column({ type: 'uuid' })
  cuentaId!: string;

  @Column({ type: 'uuid' })
  empresaId!: string;

  @ManyToOne(() => EmpresaEntity, { eager: true })
  @JoinColumn({ name: 'empresa_id' })
  empresa!: EmpresaEntity;

  @Column({ type: 'varchar', length: 30 })
  codigoClienteServicio!: string;

  @Column({ type: 'varchar', length: 7 })
  periodo!: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  monto!: number;

  @Column({ type: 'enum', enum: EstadoPago, enumName: 'estado_pago_enum' })
  estado!: EstadoPago;

  @Column({ type: 'varchar', length: 40, nullable: true })
  comprobante!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  motivo!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
