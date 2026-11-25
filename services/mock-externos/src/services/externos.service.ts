import { createHash } from 'node:crypto';
import { AppError } from '@chuno/shared';
import {
  BANCOS_ACH,
  CODIGOS_INEXISTENTES,
  DEUDAS_PREDEFINIDAS,
  EMPRESAS_EXTERNAS,
  type BancoExterno,
  type EmpresaExterna,
} from '../data/externos.data';

export interface DeudaResponse {
  codigoCliente: string;
  titular: string;
  periodo: string;
  monto: number;
}

export interface ConfirmarPagoInput {
  codigoCliente: string;
  monto: number;
  referencia: string;
}

export interface ConfirmarPagoResponse {
  comprobante: string;
}

export interface TransferenciaAchInput {
  bancoDestino: string;
  cuentaDestino: string;
  titular: string;
  monto: number;
  referencia: string;
}

export interface TransferenciaAchResponse {
  estado: 'ACEPTADA';
  codigoAch: string;
}

const TITULARES_DEMO = [
  'Lucía Fernández',
  'Roberto Torrez',
  'Gabriela Gutiérrez',
  'Diego Aramayo',
  'Valeria Justiniano',
  'Mateo Salazar',
];

const pagosConfirmados = new Map<string, ConfirmarPagoResponse>();
const transferenciasAch = new Map<string, TransferenciaAchResponse>();

function hashNumero(seed: string): number {
  const digest = createHash('sha256').update(seed).digest();
  return digest.readUInt32BE(0);
}

function buscarEmpresa(codigo: string): EmpresaExterna {
  const normalizado = codigo.trim().toUpperCase();
  const empresa = EMPRESAS_EXTERNAS.find((item) => item.codigo === normalizado);
  if (!empresa) {
    throw AppError.notFound(`La empresa de servicio '${normalizado}' no existe`);
  }
  return empresa;
}

export async function simulateExternalLatency(): Promise<void> {
  const minMs = Number(process.env.MOCK_MIN_DELAY_MS ?? '300');
  const maxMs = Number(process.env.MOCK_MAX_DELAY_MS ?? '800');
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= 0) return;

  const low = Math.max(0, Math.min(minMs, maxMs));
  const high = Math.max(low, maxMs);
  const delay = low + Math.floor(Math.random() * (high - low + 1));
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export function listarEmpresas(): EmpresaExterna[] {
  return EMPRESAS_EXTERNAS;
}

export function listarBancos(): BancoExterno[] {
  return BANCOS_ACH;
}

export function consultarDeuda(empresaCodigo: string, codigoCliente: string): DeudaResponse {
  const empresa = buscarEmpresa(empresaCodigo);
  const codigoLimpio = codigoCliente.trim();
  const codigoUpper = codigoLimpio.toUpperCase();

  if (!codigoLimpio || codigoLimpio.length < 3 || CODIGOS_INEXISTENTES.has(codigoUpper)) {
    throw AppError.notFound('Código de cliente no encontrado en la empresa de servicio', {
      empresa: empresa.codigo,
      codigoCliente: codigoLimpio,
    });
  }

  const predefinida =
    DEUDAS_PREDEFINIDAS[`${empresa.codigo}:${codigoUpper}`] ?? DEUDAS_PREDEFINIDAS[`*:${codigoUpper}`];
  if (predefinida) {
    return {
      codigoCliente: codigoLimpio,
      titular: predefinida.titular,
      periodo: predefinida.periodo,
      monto: predefinida.monto,
    };
  }

  const hash = hashNumero(`${empresa.codigo}:${codigoUpper}`);
  const centavos = 4500 + (hash % 40500);
  const monto = Number((centavos / 100).toFixed(2));
  const titular = TITULARES_DEMO[hash % TITULARES_DEMO.length];

  return {
    codigoCliente: codigoLimpio,
    titular,
    periodo: '2026-11',
    monto,
  };
}

export function confirmarPago(empresaCodigo: string, input: ConfirmarPagoInput): ConfirmarPagoResponse {
  const empresa = buscarEmpresa(empresaCodigo);
  const codigoCliente = input.codigoCliente.trim();

  if (codigoCliente.endsWith('999')) {
    throw new AppError(
      'BAD_GATEWAY',
      `El proveedor ${empresa.nombre} no pudo confirmar el pago para el código ${codigoCliente}`,
      502,
      { empresa: empresa.codigo, codigoCliente },
    );
  }

  const cacheKey = `${empresa.codigo}:${input.referencia}`;
  const existente = pagosConfirmados.get(cacheKey);
  if (existente) return existente;

  const sufijo = createHash('sha256')
    .update(`${cacheKey}:${codigoCliente}:${input.monto}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  const respuesta: ConfirmarPagoResponse = {
    comprobante: `COMP-${empresa.codigo}-${sufijo}`,
  };
  pagosConfirmados.set(cacheKey, respuesta);
  return respuesta;
}

export function procesarTransferenciaAch(input: TransferenciaAchInput): TransferenciaAchResponse {
  const bancoNormalizado = input.bancoDestino.trim().toUpperCase();
  const bancoExiste = BANCOS_ACH.some(
    (b) => b.codigo === bancoNormalizado || b.nombre.toUpperCase() === bancoNormalizado,
  );
  if (!bancoExiste) {
    throw AppError.badRequest(`El banco destino '${input.bancoDestino}' no pertenece a la red ACH`);
  }

  const cuentaDestino = input.cuentaDestino.trim();
  if (cuentaDestino.endsWith('999')) {
    throw new AppError('BUSINESS_RULE', 'Transferencia rechazada por el banco destino', 422, {
      estado: 'RECHAZADA',
      cuentaDestino,
      motivo: 'CUENTA_RECHAZADA_999',
    });
  }

  const existente = transferenciasAch.get(input.referencia);
  if (existente) return existente;

  const sufijo = createHash('sha256')
    .update(`${input.referencia}:${bancoNormalizado}:${cuentaDestino}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  const respuesta: TransferenciaAchResponse = {
    estado: 'ACEPTADA',
    codigoAch: `ACH-${sufijo}`,
  };
  transferenciasAch.set(input.referencia, respuesta);
  return respuesta;
}
