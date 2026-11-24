import { type CuentaInterna, InternalClient, type MovimientoRequest, OrigenMovimiento } from '@chuno/shared';

let client: InternalClient | undefined;

function cuentas(): InternalClient {
  client ??= new InternalClient({
    baseUrl: process.env.CUENTAS_SERVICE_URL ?? 'http://ms-cuentas:3002',
    apiKey: process.env.INTERNAL_API_KEY ?? '',
  });
  return client;
}

/** Contrato fijo de ms-cuentas (ver docs/ARQUITECTURA.md). */
export const cuentasClient = {
  obtener(cuentaId: string): Promise<CuentaInterna> {
    return cuentas().get<CuentaInterna>(`/internal/cuentas/${encodeURIComponent(cuentaId)}`);
  },

  /** Acredita el desembolso. La referencia hace la operación idempotente ante reintentos. */
  acreditarDesembolso(cuentaId: string, monto: number, referencia: string, glosa: string): Promise<unknown> {
    const body: MovimientoRequest = { monto, referencia, origen: OrigenMovimiento.DESEMBOLSO, glosa };
    return cuentas().post(`/internal/cuentas/${encodeURIComponent(cuentaId)}/acreditar`, body);
  },
};
