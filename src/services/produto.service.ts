import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { produtoRepository } from '../repositories/produto.repository';
import { filtrosSchema, produtoSchema } from '../validators/produto.schema';

type DadosProduto = z.infer<typeof produtoSchema>;

async function validarCategoria(id: string) {
  if (!(await produtoRepository.buscarCategoria(id))) throw new AppError(400, 'Categoria não encontrada');
}

async function buscar(id: string) {
  const produto = await produtoRepository.buscarPorId(id);
  if (!produto || !produto.ativo) throw new AppError(404, 'Produto não encontrado');
  return produto;
}

async function verificarDono(id: string, idArtesao: string) {
  const produto = await buscar(id);
  if (produto.idArtesao !== idArtesao) throw new AppError(403, 'Você só pode alterar seus próprios produtos');
}

export const produtoService = {
  async listar(filtros: z.infer<typeof filtrosSchema>) {
    const { pagina, limite, busca, categoriaId, tecnica, regiao, idArtesao } = filtros;
    const where: Prisma.ProdutoWhereInput = {
      ativo: true, categoriaId, idArtesao,
      tecnica: tecnica ? { contains: tecnica } : undefined,
      regiaoProducao: regiao ? { contains: regiao } : undefined,
      OR: busca ? [{ titulo: { contains: busca } }, { descricao: { contains: busca } }] : undefined,
    };
    const [dados, total] = await produtoRepository.listar(where, (pagina - 1) * limite, limite);
    return { dados, pagina, limite, total, totalPaginas: Math.ceil(total / limite) };
  },
  buscar,
  listarCategorias: produtoRepository.listarCategorias,
  async criar(dados: DadosProduto, idArtesao: string) {
    await validarCategoria(dados.categoriaId);
    return produtoRepository.criar({ ...dados, idArtesao });
  },
  async atualizar(id: string, dados: DadosProduto, idArtesao: string) {
    await verificarDono(id, idArtesao);
    await validarCategoria(dados.categoriaId);
    return produtoRepository.atualizar(id, dados);
  },
  async excluir(id: string, idArtesao: string) {
    await verificarDono(id, idArtesao);
    // Exclusão lógica preserva a referência em futuros pedidos.
    await produtoRepository.atualizar(id, { ativo: false });
  },
};
