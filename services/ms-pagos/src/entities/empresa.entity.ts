import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum TipoEmpresa {
  LUZ = 'LUZ',
  AGUA = 'AGUA',
  TELEFONO = 'TELEFONO',
  GAS = 'GAS',
  OTRO = 'OTRO',
}

@Entity({ name: 'empresa', schema: 'pagos' })
export class EmpresaEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  codigo!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'enum', enum: TipoEmpresa, enumName: 'tipo_empresa_enum' })
  tipo!: TipoEmpresa;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
