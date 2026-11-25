import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoPrestamo, numericTransformer } from '@chuno/shared';
import { Cuota } from './cuota.entity';

@Entity({ name: 'prestamo' })
@Check('ck_prestamo_monto', '"monto" > 0')
@Check('ck_prestamo_plazo', '"plazo_meses" BETWEEN 1 AND 60')
@Check('ck_prestamo_tasa', '"tasa_anual" >= 0')
export class Prestamo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_prestamo_cliente')
  @Column({ type: 'uuid' })
  clienteId!: string;

  @Column({ type: 'uuid' })
  cuentaDesembolsoId!: string;

  @Column({ type: 'varchar', length: 10 })
  cuentaDesembolsoNumero!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  monto!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: numericTransformer })
  tasaAnual!: number;

  @Column({ type: 'smallint' })
  plazoMeses!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  cuotaMensual!: number;

  @Column({ type: 'enum', enum: EstadoPrestamo, enumName: 'estado_prestamo', default: EstadoPrestamo.SOLICITADO })
  estado!: EstadoPrestamo;

  @Column({ type: 'uuid', nullable: true })
  referenciaDesembolso!: string | null;

  @OneToMany(() => Cuota, (cuota) => cuota.prestamo)
  cuotas?: Cuota[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
