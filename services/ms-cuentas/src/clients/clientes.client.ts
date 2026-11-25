import { AppError, type ClienteInterno, InternalClient } from '@chuno/shared';

export async function buscarCliente(id: string): Promise<ClienteInterno> {
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!apiKey) throw AppError.serviceUnavailable('No se pudo validar el cliente');

  const client = new InternalClient({
    baseUrl: process.env.CLIENTES_SERVICE_URL ?? process.env.CLIENTES_URL ?? 'http://ms-clientes:3001',
    apiKey,
  });
  try {
    return await client.get<ClienteInterno>(`/internal/clientes/${id}`);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      throw AppError.notFound('Cliente no encontrado');
    }
    throw AppError.serviceUnavailable('No se pudo validar el cliente');
  }
}
