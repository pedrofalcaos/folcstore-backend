import { z } from 'zod';
import { enderecoSchema } from './compra.schema';

function validarCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  const digito1 = resto >= 10 ? 0 : resto;
  if (digito1 !== parseInt(cpf.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  resto = 11 - (soma % 11);
  const digito2 = resto >= 10 ? 0 : resto;
  return digito2 === parseInt(cpf.charAt(10), 10);
}

const email = z
  .string()
  .trim()
  .email('Informe um e-mail válido.')
  .max(254, 'O e-mail deve ter até 254 caracteres.')
  .toLowerCase();


const senhaCadastro = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula.')
  .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula.')
  .regex(/[0-9]/, 'A senha deve conter pelo menos um número.')
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'A senha deve ter no máximo 72 bytes');

const cpfSchema = z
  .string()
  .transform(value => value.replace(/\D/g, ''))
  .pipe(
    z
      .string()
      .length(11, 'CPF: informe os 11 dígitos.')
      .refine(validarCpf, 'CPF inválido.')
  );

export const registerSchema = z.object({
  nome: z.string().trim().min(2, 'O nome precisa ter pelo menos 2 caracteres.').max(100, 'O nome deve ter até 100 caracteres.'),
  email,
  senha: senhaCadastro,
  perfil: z.enum(['COMPRADOR', 'ARTESAO']).default('COMPRADOR'),
  cpf: cpfSchema.optional(),
  telefone: z.string().trim().max(30).default(''),
  enderecos: z.array(enderecoSchema).max(10).default([]),
}).strict();

export const loginSchema = z.object({
  email,
  senha: z.string().min(1, 'Informe a senha.'),
}).strict();

