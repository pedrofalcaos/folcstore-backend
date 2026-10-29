import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

const respostaSchema = z.object({
  modo: z.enum(['sequencial', 'paralelo']), duracaoMs: z.number().nonnegative(),
  resultados: z.array(z.object({ produtoId: z.string(), itens: z.array(z.object({
    produtoId: z.string(), score: z.number().min(0).max(1), motivo: z.string(),
  })) })),
});

export async function consultarRecomendador(entrada: {
  produtos: { id: string; descricao: string; tecnica: string; regiaoProducao: string }[];
  ids: string[]; modo: 'sequencial' | 'paralelo'; limite: number;
}) {
  try {
    const resposta = await fetch(`${env.RECOMMENDER_URL}/recomendacoes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entrada), signal: AbortSignal.timeout(env.RECOMMENDER_TIMEOUT_MS),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return respostaSchema.parse(await resposta.json());
  } catch (erro) {
    console.error('Recomendador indisponível:', erro instanceof Error ? erro.message : 'falha');
    throw new AppError(503, 'Recomendador indisponível. Tente novamente mais tarde.');
  }
}
