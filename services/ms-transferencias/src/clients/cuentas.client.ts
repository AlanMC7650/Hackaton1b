import { InternalClient, optionalEnv } from '@chuno/shared';
import type { CuentaInterna, MovimientoRequest, TransferirRequest } from '@chuno/shared';

/** Cliente de los endpoints internos de ms-cuentas (contrato fijo de HU-01 CA-03). */
export class CuentasClient {
  private cliente?: InternalClient;

  constructor(cliente?: InternalClient) {
    this.cliente = cliente;
  }

  // Se crea al primer uso para no exigir variables de entorno al importar el módulo.
  private get http(): InternalClient {
    this.cliente ??= new InternalClient({
      baseUrl: optionalEnv('CUENTAS_SERVICE_URL', 'http://ms-cuentas:3002'),
      apiKey: optionalEnv('INTERNAL_API_KEY', ''),
    });
    return this.cliente;
  }

  obtenerPorId(id: string): Promise<CuentaInterna> {
    return this.http.get<CuentaInterna>(`/internal/cuentas/${encodeURIComponent(id)}`);
  }

  obtenerPorNumero(numero: string): Promise<CuentaInterna> {
    return this.http.get<CuentaInterna>(`/internal/cuentas/numero/${encodeURIComponent(numero)}`);
  }

  /** Débito y crédito atómicos: o pasan los dos movimientos o ninguno. */
  transferir(body: TransferirRequest): Promise<unknown> {
    return this.http.post<unknown>('/internal/transferir', body);
  }

  debitar(cuentaId: string, body: MovimientoRequest): Promise<unknown> {
    return this.http.post<unknown>(`/internal/cuentas/${encodeURIComponent(cuentaId)}/debitar`, body);
  }

  acreditar(cuentaId: string, body: MovimientoRequest): Promise<unknown> {
    return this.http.post<unknown>(`/internal/cuentas/${encodeURIComponent(cuentaId)}/acreditar`, body);
  }
}
