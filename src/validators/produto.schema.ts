import { z } from 'zod';

export const produtoSchema = z.object({
  titulo: z.string().trim().min(3).max(150),
  descricao: z.string().trim().min(10).max(3000),
  tecnica: z.string().trim().min(2).max(100),
  regiaoProducao: z.string().trim().min(2).max(100),
  categoriaId: z.string().uuid(),
  precoCentavos: z.number().int().positive().max(100000000),
  quantidadeEstoque: z.number().int().min(0).max(1000000),
  tipo: z.enum(['UNICO', 'LOTE']),
}).strict().refine(p => p.tipo !== 'UNICO' || p.quantidadeEstoque <= 1, {
  message: 'Peça única deve ter estoque 0 ou 1', path: ['quantidadeEstoque'],
});

export const filtrosSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(1000000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(12),
  busca: z.string().trim().max(150).optional(),
  categoriaId: z.string().uuid().optional(),
  tecnica: z.string().trim().max(100).optional(),
  regiao: z.string().trim().max(100).optional(),
  idArtesao: z.string().uuid().optional(),
}).strict();

export const idSchema = z.string().uuid();
