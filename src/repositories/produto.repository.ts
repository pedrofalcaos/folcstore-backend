import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

const include = {
  categoria: true,
  artesao: { select: { id: true, nome: true } },
};

export const produtoRepository = {
  listar: (where: Prisma.ProdutoWhereInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.produto.findMany({ where, skip, take, include, orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }] }),
      prisma.produto.count({ where }),
    ]),
  buscarPorId: (id: string) => prisma.produto.findUnique({ where: { id }, include }),
  criar: (data: Prisma.ProdutoUncheckedCreateInput) => prisma.produto.create({ data, include }),
  atualizar: (id: string, data: Prisma.ProdutoUncheckedUpdateInput) =>
    prisma.produto.update({ where: { id }, data, include }),
  buscarCategoria: (id: string) => prisma.categoria.findUnique({ where: { id } }),
  listarCategorias: () => prisma.categoria.findMany({ orderBy: { nome: 'asc' } }),
};
