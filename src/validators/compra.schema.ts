import { z } from 'zod';

export const enderecoSchema = z.object({
  cep: z.string().trim().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  rua: z.string().trim().min(2).max(150),
  numero: z.string().trim().min(1).max(20),
  bairro: z.string().trim().min(2).max(100),
  complemento: z.string().trim().max(100).default(''),
  cidade: z.string().trim().min(2).max(100),
  estado: z.string().trim().toUpperCase().regex(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/),
}).strict();

export const itemCarrinhoSchema = z.object({
  produtoId: z.string().uuid(), quantidade: z.number().int().min(1).max(99),
}).strict();

export const checkoutSchema = z.object({
  enderecoId: z.string().uuid(),
  metodoPagamento: z.enum(['PIX', 'CARTAO']),
  versaoCarrinho: z.number().int().nonnegative(),
  totalEsperadoCentavos: z.number().int().positive().max(2147483647),
}).strict();
