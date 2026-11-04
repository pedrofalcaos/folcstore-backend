import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export type BancoCompra = Prisma.TransactionClient;
export const incluirProduto = {
  produto: { include: { categoria: true, artesao: { select: { id: true, nome: true } } } },
};

// Bloqueia as escritas no SQLite e a linha do comprador no PostgreSQL.
// O bloqueio vem antes das leituras do carrinho.
export async function transacaoCompra<T>(compradorId: string, operacao: (db: BancoCompra) => Promise<T>) {
  return prisma.$transaction(async db => {
    await db.$executeRaw`UPDATE "Usuario" SET "id" = "id" WHERE "id" = ${compradorId}`;
    return operacao(db);
  }, { maxWait: 10000, timeout: 15000 });
}

export async function lerCarrinho(db: BancoCompra, compradorId: string) {
  const usuario = await db.usuario.findUniqueOrThrow({ where: { id: compradorId } });
  const itens = await db.itemCarrinho.findMany({
    where: { compradorId }, include: incluirProduto, orderBy: { produtoId: 'asc' },
  });
  return {
    versao: usuario.versaoCarrinho,
    itens: itens.map(item => ({ produto: item.produto, quantidade: item.quantidade,
      subtotalCentavos: item.produto.precoCentavos * item.quantidade })),
    totalCentavos: itens.reduce((total, item) => total + item.produto.precoCentavos * item.quantidade, 0),
  };
}
