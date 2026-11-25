import bcrypt from 'bcryptjs';
import { EstadoCliente, RolCliente } from '@chuno/shared';
import { AppDataSource } from '../data-source';
import { Cliente } from '../entities/cliente.entity';
import { ClienteRepository } from '../repositories/cliente.repository';

/**
 * IDs fijos para que ms-cuentas (HU-05/06) pueda referenciarlos en su semilla sin cruzar schemas.
 */
export const CLIENTES_DEMO = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    ci: '1000000',
    nombres: 'Admin',
    apellidos: 'Chuno',
    email: 'admin@chuno.bo',
    telefono: '70000000',
    direccion: 'Oficina Central CHUNO',
    password: 'Admin123!',
    rol: RolCliente.ADMIN,
  },
  {
    id: '22222222-2222-4222-8222-222222222201',
    ci: '6000001',
    nombres: 'Carlos',
    apellidos: 'Mamani Quispe',
    email: 'carlos.mamani@chuno.bo',
    telefono: '71234501',
    direccion: 'Av. 6 de Agosto 123, La Paz',
    password: 'Cliente123!',
    rol: RolCliente.CLIENTE,
  },
  {
    id: '22222222-2222-4222-8222-222222222202',
    ci: '6000002',
    nombres: 'Lucía',
    apellidos: 'Flores Vargas',
    email: 'lucia.flores@chuno.bo',
    telefono: '71234502',
    direccion: 'Calle España 456, Cochabamba',
    password: 'Cliente123!',
    rol: RolCliente.CLIENTE,
  },
  {
    id: '22222222-2222-4222-8222-222222222203',
    ci: '6000003',
    nombres: 'Diego',
    apellidos: 'Rojas Mendoza',
    email: 'diego.rojas@chuno.bo',
    telefono: '71234503',
    direccion: 'Av. Cristo Redentor 789, Santa Cruz',
    password: 'Cliente123!',
    rol: RolCliente.CLIENTE,
  },
];

async function seed(): Promise<void> {
  const repo = new ClienteRepository();

  for (const datos of CLIENTES_DEMO) {
    const existente = (await repo.findById(datos.id)) ?? (await repo.findByEmail(datos.email));
    const cliente = existente ?? new Cliente();

    cliente.id = existente?.id ?? datos.id;
    cliente.ci = datos.ci;
    cliente.nombres = datos.nombres;
    cliente.apellidos = datos.apellidos;
    cliente.email = datos.email;
    cliente.telefono = datos.telefono;
    cliente.direccion = datos.direccion;
    cliente.passwordHash = await bcrypt.hash(datos.password, 10);
    cliente.rol = datos.rol;
    cliente.estado = EstadoCliente.ACTIVO;
    cliente.intentosFallidos = 0;
    cliente.bloqueadoHasta = null;

    await repo.save(cliente);
  }
}

AppDataSource.initialize()
  .then(seed)
  .then(() => AppDataSource.destroy())
  .then(() => console.log('[ms-clientes] Semilla de clientes aplicada'))
  .catch((error: unknown) => {
    console.error('[ms-clientes] La semilla de clientes falló:', error);
    process.exit(1);
  });
