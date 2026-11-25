import { AppError } from '@chuno/shared';

export interface DeudaExternaResponse {
  codigoCliente: string;
  titular: string;
  periodo: string;
  monto: number;
}

export interface ConfirmarPagoExternaRequest {
  codigoCliente: string;
  monto: number;
  referencia: string;
}

export interface ConfirmarPagoExternaResponse {
  comprobante: string;
}

interface ErrorPayload {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

export class ExternosClient {
  private readonly timeoutMs: number;

  constructor(timeoutMs = 3000) {
    this.timeoutMs = timeoutMs;
  }

  private get baseUrl(): string {
    return (process.env.EXTERNOS_SERVICE_URL ?? 'http://mock-externos:3010').replace(/\/+$/, '');
  }

  async consultarDeuda(empresaCodigo: string, codigoCliente: string): Promise<DeudaExternaResponse> {
    const path = `/empresas/${encodeURIComponent(empresaCodigo)}/deudas/${encodeURIComponent(codigoCliente)}`;
    return this.requestWithRetry<DeudaExternaResponse>('GET', path);
  }

  async confirmarPago(empresaCodigo: string, body: ConfirmarPagoExternaRequest): Promise<ConfirmarPagoExternaResponse> {
    const path = `/empresas/${encodeURIComponent(empresaCodigo)}/pagos`;
    return this.execute<ConfirmarPagoExternaResponse>('POST', path, body);
  }

  private async requestWithRetry<T>(method: 'GET', path: string): Promise<T> {
    try {
      return await this.execute<T>(method, path);
    } catch (error) {
      const retriable = error instanceof AppError ? error.status >= 500 : true;
      if (!retriable) throw error;
      return this.execute<T>(method, path);
    }
  }

  private async execute<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        redirect: 'error',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
        const message =
          typeof payload?.message === 'string' ? payload.message : 'El proveedor externo no pudo procesar la solicitud';

        if (response.status === 404) {
          throw AppError.notFound(message, payload?.details ?? null);
        }
        if (response.status === 400) {
          throw AppError.badRequest(message, payload?.details ?? null);
        }
        if (response.status === 422) {
          throw AppError.businessRule(message, payload?.details ?? null);
        }
        throw AppError.serviceUnavailable(message, payload?.details ?? null);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw AppError.serviceUnavailable('El proveedor externo tardó demasiado en responder');
      }
      throw AppError.serviceUnavailable('No se pudo contactar al proveedor externo');
    } finally {
      clearTimeout(timer);
    }
  }
}
