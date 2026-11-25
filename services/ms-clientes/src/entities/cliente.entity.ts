import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoCliente, RolCliente } from '@chuno/shared';

@Entity({ name: 'cliente' })
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 15, unique: true })
  ci!: string;

  @Column({ type: 'varchar', length: 100 })
  nombres!: string;

  @Column({ type: 'varchar', length: 100 })
  apellidos!: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  direccion!: string | null;

  @Column({ type: 'varchar', length: 100, select: false })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: RolCliente,
    enumName: 'rol_cliente',
    default: RolCliente.CLIENTE,
  })
  rol!: RolCliente;

  @Column({
    type: 'enum',
    enum: EstadoCliente,
    enumName: 'estado_cliente',
    default: EstadoCliente.ACTIVO,
  })
  estado!: EstadoCliente;

  @Column({ type: 'smallint', default: 0 })
  intentosFallidos!: number;

  @Column({ type: 'timestamptz', nullable: true })
  bloqueadoHasta!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
