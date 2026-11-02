import { z } from 'zod';
import { enderecoSchema } from './compra.schema';

const email = z.string().trim().email('Informe um e-mail válido.').max(254, 'O e-mail deve ter até 254 caracteres.').toLowerCase();
// bcrypt considera até 72 bytes, não apenas 72 caracteres.
const senha = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').refine(value => Buffer.byteLength(value, 'utf8') <= 72,
  'A senha deve ter no máximo 72 bytes');

export const registerSchema = z.object({
  nome: z.string().trim().min(2, 'O nome precisa ter pelo menos 2 caracteres.').max(100, 'O nome deve ter até 100 caracteres.'),
  email,
  senha,
  perfil: z.enum(['COMPRADOR', 'ARTESAO']).default('COMPRADOR'),
  cpf: z.string().transform(value => value.replace(/\D/g, '')).pipe(z.string().length(11, 'CPF: informe os 11 dígitos.')).optional(),
  telefone: z.string().trim().max(30).default(''),
  enderecos: z.array(enderecoSchema).max(10).default([]),
}).strict();

export const loginSchema = z.object({ email, senha }).strict();
