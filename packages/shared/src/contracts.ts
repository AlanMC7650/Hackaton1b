import type { EstadoCliente, EstadoCuenta, OrigenMovimiento, RolCliente } from './enums';

/** Cabeceras de identidad que el gateway propaga a los servicios. */
export const HEADERS = {
  userId: 'x-user-id',
  userRole: 'x-user-rol',
  requestId: 'x-request-id',
  internalKey: 'x-internal-key',
} as const;

export interface ClienteInterno {
  id: string;
  nombreCompleto: string;
  estado: EstadoCliente;
}

export interface CuentaInterna {
  id: string;
  numero: string;
  clienteId: string;
  saldo: number;
  estado: EstadoCuenta;
}

export interface MovimientoRequest {
  monto: number;
  referencia: string;
  origen: OrigenMovimiento;
  glosa: string;
}

export interface TransferirRequest {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  monto: number;
  referencia: string;
  glosa: string;
}

export interface HealthResponse {
  service: string;
  status: 'OK' | 'DEGRADED';
  db: 'up' | 'down' | 'not_configured';
}

/** Payload del JWT que emite ms-clientes y valida el gateway. */
export interface JwtPayload {
  sub: string;
  rol: RolCliente;
}
