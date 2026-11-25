import { z } from 'zod';

export const deudaQuerySchema = z.object({
  empresa: z.string().trim().min(1, 'El código de empresa es obligatorio').max(20),
  codigo: z.string().trim().min(1, 'El código de cliente de servicio es obligatorio').max(30),
});

export const crearPagoSchema = z.object({
  cuentaId: z.string().uuid('cuentaId debe ser un UUID válido'),
  empresaCodigo: z.string().trim().min(1, 'empresaCodigo es obligatorio').max(20),
  codigoClienteServicio: z.string().trim().min(1, 'codigoClienteServicio es obligatorio').max(30),
});

export const listarPagosQuerySchema = z.object({
  clienteId: z.string().uuid('clienteId debe ser un UUID válido').optional(),
});

export const pagoIdParamsSchema = z.object({
  id: z.string().uuid('id debe ser un UUID válido'),
});

export type DeudaQueryDto = z.infer<typeof deudaQuerySchema>;
export type CrearPagoDto = z.infer<typeof crearPagoSchema>;
export type ListarPagosQueryDto = z.infer<typeof listarPagosQuerySchema>;
