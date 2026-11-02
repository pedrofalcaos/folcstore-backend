import { z } from 'zod';
import { enderecoSchema } from './compra.schema';

const email = z.string().trim().email().max(254).toLowerCase();
// bcrypt considera até 72 bytes, não apenas 72 caracteres.
const senha = z.string().min(8).refine(value => Buffer.byteLength(value, 'utf8') <= 72,
  'A senha deve ter no máximo 72 bytes');

export const registerSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  email,
  senha,
  perfil: z.enum(['COMPRADOR', 'ARTESAO']).default('COMPRADOR'),
  cpf: z.string().transform(value => value.replace(/\D/g, '')).pipe(z.string().length(11)).optional(),
  telefone: z.string().trim().max(30).default(''),
  enderecos: z.array(enderecoSchema).max(10).default([]),
}).strict();

export const loginSchema = z.object({ email, senha }).strict();
