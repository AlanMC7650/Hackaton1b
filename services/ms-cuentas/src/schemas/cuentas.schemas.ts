import { OrigenMovimiento } from '@chuno/shared';
import { z } from 'zod';

export const uuid = z.guid().transform((value) => value.toLowerCase());
export const numeroCuenta = z.string().regex(/^\d{10}$/);
const alias = z
  .string()
  .trim()
  .max(50)
  .transform((value) => value || null)
  .nullable();
const glosa = z.string().trim().max(150);
export const saldoMaximo = 999_999_999_999.99;
const monto = z
  .number()
  .positive()
  .max(saldoMaximo)
  .refine((value) => Number(value.toFixed(2)) === value, 'El monto debe tener hasta dos decimales');

export const apertura = z.strictObject({ clienteId: uuid.optional(), alias: alias.optional() });
export const filtroCuentas = z.strictObject({ clienteId: uuid.optional() });
export const cambioAlias = z.strictObject({ alias });
export const operacionPublica = z.strictObject({ monto, glosa: glosa.optional() });
export const operacionInterna = z.strictObject({
  monto,
  referencia: uuid,
  origen: z.enum(OrigenMovimiento),
  glosa,
});
export const transferencia = z.strictObject({
  cuentaOrigenId: uuid,
  cuentaDestinoId: uuid,
  monto,
  referencia: uuid,
  glosa,
});
