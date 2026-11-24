import { z } from 'zod';
import { TipoTransferencia } from '@chuno/shared';

export const MONTO_MAXIMO = 50_000;
export const BANCO_INTERNO = 'CHUNO';

const monto = z
  .number('El monto debe ser un número')
  .positive('El monto debe ser mayor a 0')
  .max(MONTO_MAXIMO, 'El monto máximo por transferencia es Bs 50.000')
  .refine((valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6, 'El monto admite máximo 2 decimales');

const comunes = {
  // guid (y no uuid) para aceptar también los ids fijos de las semillas.
  cuentaOrigenId: z.guid('La cuenta de origen es inválida'),
  monto,
  glosa: z.string().trim().max(150, 'La glosa admite máximo 150 caracteres').optional(),
  referencia: z.guid('La referencia es inválida').optional(),
};

const numeroCuentaChuno = z.string().trim().regex(/^\d{10}$/, 'El número de cuenta debe tener 10 dígitos');

const propia = z.object({
  ...comunes,
  tipo: z.literal(TipoTransferencia.PROPIA),
  cuentaDestinoNumero: numeroCuentaChuno,
});

const tercero = z.object({
  ...comunes,
  tipo: z.literal(TipoTransferencia.TERCERO),
  cuentaDestinoNumero: numeroCuentaChuno,
});

const interbancaria = z.object({
  ...comunes,
  tipo: z.literal(TipoTransferencia.INTERBANCARIA),
  bancoDestino: z
    .string()
    .trim()
    .min(1, 'Indique el banco destino')
    .max(50)
    .refine((banco) => banco.toUpperCase() !== BANCO_INTERNO, 'Para cuentas de Chuno use transferencia a terceros'),
  cuentaDestinoNumero: z.string().trim().min(1, 'Indique la cuenta destino').max(30),
  titularDestino: z.string().trim().min(1, 'Indique el titular de la cuenta destino').max(150),
});

export const crearTransferenciaSchema = z.discriminatedUnion('tipo', [propia, tercero, interbancaria]);
export type CrearTransferenciaDto = z.infer<typeof crearTransferenciaSchema>;

export const listarTransferenciasSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** Solo lo usa el ADMIN para filtrar por cliente. */
  clienteId: z.guid().optional(),
});
export type ListarTransferenciasQuery = z.infer<typeof listarTransferenciasSchema>;
