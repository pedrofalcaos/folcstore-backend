import { z } from 'zod';

const email = z.string().trim().email().max(254).toLowerCase();
// bcrypt considera até 72 bytes, não apenas 72 caracteres.
const senha = z.string().min(8).refine(value => Buffer.byteLength(value, 'utf8') <= 72,
  'A senha deve ter no máximo 72 bytes');

export const registerSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  email,
  senha,
  perfil: z.enum(['COMPRADOR', 'ARTESAO']).default('COMPRADOR'),
}).strict();

export const loginSchema = z.object({ email, senha }).strict();
