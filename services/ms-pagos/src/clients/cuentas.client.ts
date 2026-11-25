import { InternalClient, type CuentaInterna, type MovimientoRequest } from '@chuno/shared';

export interface MovimientoInternoResponse {
  id: string;
  cuentaId: string;
  tipo: string;
  origen: string;
  monto: number;
  saldoResultante: number;
  referencia: string;
  glosa: string;
}

export class CuentasClient {
  private client: InternalClient | null = null;

  private getClient(): InternalClient {
    if (!this.client) {
      const baseUrl = process.env.CUENTAS_SERVICE_URL ?? 'http://ms-cuentas:3002';
      const apiKey = process.env.INTERNAL_API_KEY ?? '';
      this.client = new InternalClient({ baseUrl, apiKey, timeoutMs: 3000, retries: 1 });
    }
    return this.client;
  }

  async obtenerCuenta(cuentaId: string): Promise<CuentaInterna> {
    return this.getClient().get<CuentaInterna>(`/internal/cuentas/${encodeURIComponent(cuentaId)}`);
  }

  async debitar(cuentaId: string, body: MovimientoRequest): Promise<MovimientoInternoResponse> {
    return this.getClient().post<MovimientoInternoResponse>(
      `/internal/cuentas/${encodeURIComponent(cuentaId)}/debitar`,
      body,
    );
  }

  async acreditar(cuentaId: string, body: MovimientoRequest): Promise<MovimientoInternoResponse> {
    return this.getClient().post<MovimientoInternoResponse>(
      `/internal/cuentas/${encodeURIComponent(cuentaId)}/acreditar`,
      body,
    );
  }
}
