import { lerCarrinho, transacaoCompra } from '../repositories/compra.repository';
import { AppError } from '../errors/AppError';

export const carrinhoService = {
  buscar: (compradorId: string) => transacaoCompra(compradorId, db => lerCarrinho(db, compradorId)),
  async definirItem(compradorId: string, produtoId: string, quantidade: number) {
    return transacaoCompra(compradorId, async db => {
      const produto = await db.produto.findUnique({ where: { id: produtoId } });
      if (!produto || !produto.ativo) throw new AppError(404, 'Produto não disponível');
      if (produto.quantidadeEstoque < quantidade) throw new AppError(409, 'Quantidade acima do estoque disponível');
      const existente = await db.itemCarrinho.findUnique({ where: { compradorId_produtoId: { compradorId, produtoId } } });
      if (!existente && await db.itemCarrinho.count({ where: { compradorId } }) >= 50) {
        throw new AppError(422, 'Limite de 50 produtos por carrinho');
      }
      await db.itemCarrinho.upsert({
        where: { compradorId_produtoId: { compradorId, produtoId } },
        update: { quantidade }, create: { compradorId, produtoId, quantidade },
      });
      await db.usuario.update({ where: { id: compradorId }, data: { versaoCarrinho: { increment: 1 } } });
      return lerCarrinho(db, compradorId);
    });
  },
  async remover(compradorId: string, produtoId?: string) {
    return transacaoCompra(compradorId, async db => {
      await db.itemCarrinho.deleteMany({ where: { compradorId, produtoId } });
      await db.usuario.update({ where: { id: compradorId }, data: { versaoCarrinho: { increment: 1 } } });
      return lerCarrinho(db, compradorId);
    });
  },
};
