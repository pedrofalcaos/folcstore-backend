import { prisma } from '../config/prisma';

export const carregarCatalogo = () => prisma.produto.findMany({
  where: { ativo: true, quantidadeEstoque: { gt: 0 } },
  select: { id: true, idArtesao: true, titulo: true, descricao: true, tecnica: true, regiaoProducao: true, precoCentavos: true },
  orderBy: { id: 'asc' }, take: 2001,
});
