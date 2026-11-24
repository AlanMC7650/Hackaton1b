import { InternalClient, optionalEnv } from '@chuno/shared';

export interface Banco {
  codigo: string;
  nombre: string;
}

export interface OrdenInterbancaria {
  bancoDestino: string;
  cuentaDestino: string;
  titular: string;
  monto: number;
  referencia: string;
}

export interface RespuestaInterbancaria {
  estado?: string;
  codigoAch?: string;
}

/** Cliente del intermediario interbancario simulado (mock-externos, rutas /ach/*). */
export class ExternosClient {
  private cliente?: InternalClient;

  constructor(cliente?: InternalClient) {
    this.cliente = cliente;
  }

  private get http(): InternalClient {
    this.cliente ??= new InternalClient({
      baseUrl: optionalEnv('EXTERNOS_SERVICE_URL', 'http://mock-externos:3010'),
      apiKey: optionalEnv('INTERNAL_API_KEY', ''),
    });
    return this.cliente;
  }

  listarBancos(): Promise<unknown> {
    return this.http.get<unknown>('/ach/bancos');
  }

  enviarOrden(orden: OrdenInterbancaria): Promise<RespuestaInterbancaria> {
    return this.http.post<RespuestaInterbancaria>('/ach/transferencias', orden);
  }
}
