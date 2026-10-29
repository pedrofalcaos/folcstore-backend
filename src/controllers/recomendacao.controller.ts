import { RequestHandler } from 'express';
import { z } from 'zod';
import { gerarRecomendacoes } from '../services/recomendacao.service';

const schema = z.object({
  produtoId: z.string().uuid(), limite: z.coerce.number().int().min(1).max(20).default(4),
  modo: z.enum(['sequencial', 'paralelo']).default('sequencial'),
}).strict();

export const recomendar: RequestHandler = async (req, res) => {
  const { produtoId, modo, limite } = schema.parse(req.query);
  res.json(await gerarRecomendacoes(modo, limite, { produtoId }));
};

export const recomendarLote: RequestHandler = async (req, res) => {
  const { modo, limite } = schema.omit({ produtoId: true }).parse(req.body);
  res.json(await gerarRecomendacoes(modo, limite, { idArtesao: req.usuario!.id }));
};
