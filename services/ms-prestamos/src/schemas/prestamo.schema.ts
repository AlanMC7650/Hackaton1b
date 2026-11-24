import { z } from 'zod';

const monto = z.coerce.number().positive('El monto debe ser mayor a 0').max(1_000_000, 'Monto máximo 1 000 000 Bs');
const plazoMeses = z.coerce.number().int('El plazo debe ser entero').min(1, 'Plazo mínimo 1 mes').max(60, 'Plazo máximo 60 meses');
const tasaAnual = z.coerce.number().min(0, 'La tasa no puede ser negativa').max(100, 'Tasa máxima 100 %');

export const simularSchema = z.object({ monto, plazoMeses, tasaAnual });

export const crearPrestamoSchema = z.object({
  clienteId: z.uuid('clienteId inválido').optional(),
  cuentaDesembolsoId: z.uuid('cuentaDesembolsoId inválido'),
  monto,
  plazoMeses,
  tasaAnual,
});

export const actualizarPrestamoSchema = z
  .object({
    cuentaDesembolsoId: z.uuid('cuentaDesembolsoId inválido').optional(),
    monto: monto.optional(),
    plazoMeses: plazoMeses.optional(),
    tasaAnual: tasaAnual.optional(),
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'Debe enviar al menos un campo para modificar',
  });

export type SimularDto = z.infer<typeof simularSchema>;
export type CrearPrestamoDto = z.infer<typeof crearPrestamoSchema>;
export type ActualizarPrestamoDto = z.infer<typeof actualizarPrestamoSchema>;
