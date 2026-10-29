import { carregarCatalogo } from '../repositories/recomendacao.repository';
import { consultarRecomendador } from '../integrations/recomendador';
import { AppError } from '../errors/AppError';

export async function gerarRecomendacoes(modo: 'sequencial' | 'paralelo', limite: number,
  filtro: { produtoId: string } | { idArtesao: string }) {
  const produtos = await carregarCatalogo();
  if (produtos.length > 2000) throw new AppError(422, 'Catálogo acima do limite desta versão (2000 produtos)');
  const ids = produtos.filter(p => 'produtoId' in filtro ? p.id === filtro.produtoId : p.idArtesao === filtro.idArtesao).map(p => p.id);
  if (!ids.length) throw new AppError(404, 'Nenhum produto disponível encontrado');
  const resultado = await consultarRecomendador({ produtos, ids, modo, limite });
  const indice = new Map(produtos.map(p => [p.id, p]));
  if (resultado.resultados.length !== ids.length || resultado.resultados.some((r, i) => r.produtoId !== ids[i]
    || r.itens.length > limite || new Set(r.itens.map(item => item.produtoId)).size !== r.itens.length
    || r.itens.some(item => item.produtoId === r.produtoId || !indice.has(item.produtoId)))) {
    throw new AppError(502, 'Resposta inconsistente do recomendador');
  }
  return { ...resultado, resultados: resultado.resultados.map(r => ({ ...r,
    itens: r.itens.map(i => ({ ...i, produto: indice.get(i.produtoId) })),
  })) };
}
