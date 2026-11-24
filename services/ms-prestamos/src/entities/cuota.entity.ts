import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { numericTransformer } from '@chuno/shared';
import { Prestamo } from './prestamo.entity';

@Entity({ name: 'cuota' })
@Unique('uq_cuota_prestamo_numero', ['prestamoId', 'numero'])
export class Cuota {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  prestamoId!: string;

  @ManyToOne(() => Prestamo, (prestamo) => prestamo.cuotas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prestamo_id', foreignKeyConstraintName: 'fk_cuota_prestamo' })
  prestamo?: Prestamo;

  @Column({ type: 'smallint' })
  numero!: number;

  /** Fecha de negocio en formato 'YYYY-MM-DD'. */
  @Column({ type: 'date' })
  fechaVencimiento!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  capital!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  interes!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  cuota!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  saldo!: number;
}
