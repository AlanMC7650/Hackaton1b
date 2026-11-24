import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoTransferencia, TipoTransferencia, numericTransformer } from '@chuno/shared';

@Entity({ name: 'transferencia' })
@Check('ck_transferencia_monto', '"monto" > 0 AND "monto" <= 50000')
export class Transferencia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Uuid generado por quien inicia la operación; si llega repetido se devuelve el resultado anterior. */
  @Index('uq_transferencia_referencia', { unique: true })
  @Column({ type: 'uuid' })
  referencia!: string;

  @Index('ix_transferencia_cliente_id')
  @Column({ type: 'uuid' })
  clienteId!: string;

  @Column({ type: 'enum', enum: TipoTransferencia, enumName: 'transferencia_tipo_enum' })
  tipo!: TipoTransferencia;

  @Column({ type: 'uuid' })
  cuentaOrigenId!: string;

  /** Nulo en las interbancarias. Sin FK: la cuenta vive en el schema de ms-cuentas. */
  @Column({ type: 'uuid', nullable: true })
  cuentaDestinoId!: string | null;

  @Column({ type: 'varchar', length: 30 })
  cuentaDestinoNumero!: string;

  /** `CHUNO` si la transferencia es interna. */
  @Column({ type: 'varchar', length: 50 })
  bancoDestino!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  titularDestino!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  monto!: number;

  @Column({ type: 'varchar', length: 150 })
  glosa!: string;

  @Column({ type: 'enum', enum: EstadoTransferencia, enumName: 'transferencia_estado_enum' })
  estado!: EstadoTransferencia;

  /** Código que devuelve el intermediario interbancario cuando acepta la orden. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  codigoExterno!: string | null;

  /** Por qué quedó RECHAZADA o REVERTIDA. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  motivo!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
