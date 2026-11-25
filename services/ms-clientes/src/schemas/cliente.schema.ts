import { z } from 'zod';
import { RolCliente } from '@chuno/shared';

export const loginSchema = z.object({
  email: z.string().trim().email('Correo inválido').transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const createClienteSchema = z.object({
  ci: z.string().trim().min(4, 'CI inválido').max(15, 'CI máximo 15 caracteres'),
  nombres: z.string().trim().min(2, 'Nombres requeridos').max(100),
  apellidos: z.string().trim().min(2, 'Apellidos requeridos').max(100),
  email: z.string().trim().email('Correo inválido').max(150).transform((v) => v.toLowerCase()),
  telefono: z.string().trim().max(20).optional().nullable(),
  direccion: z.string().trim().max(200).optional().nullable(),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(100),
  rol: z.nativeEnum(RolCliente).optional().default(RolCliente.CLIENTE),
});

export const updateClienteSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('Correo inválido')
      .max(150)
      .transform((v) => v.toLowerCase())
      .optional(),
    telefono: z.string().trim().max(20).nullable().optional(),
    direccion: z.string().trim().max(200).nullable().optional(),
  })
  .refine((data) => data.email !== undefined || data.telefono !== undefined || data.direccion !== undefined, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;
