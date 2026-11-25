import { type ClienteInterno, InternalClient } from '@chuno/shared';

let client: InternalClient | undefined;

function clientes(): InternalClient {
  client ??= new InternalClient({
    baseUrl: process.env.CLIENTES_SERVICE_URL ?? 'http://ms-clientes:3001',
    apiKey: process.env.INTERNAL_API_KEY ?? '',
  });
  return client;
}

export const clientesClient = {
  obtener(clienteId: string): Promise<ClienteInterno> {
    return clientes().get<ClienteInterno>(`/internal/clientes/${encodeURIComponent(clienteId)}`);
  },
};
