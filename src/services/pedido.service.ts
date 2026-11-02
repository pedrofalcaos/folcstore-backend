import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { AppError } from '../errors/AppError';
import { transacaoCompra } from '../repositories/compra.repository';
import { checkoutSchema } from '../validators/compra.schema';

export async function confirmarPedido(compradorId: string, chave: string, dados: z.infer<typeof checkoutSchema>) {
  const hash = createHash('sha256').update(JSON.stringify(dados)).digest('hex');
  return transacaoCompra(compradorId, async db => {
    const existente = await db.pedido.findUnique({
      where: { compradorId_chaveIdempotencia: { compradorId, chaveIdempotencia: chave } }, include: { itens: true },
    });
    if (existente) {
      if (existente.solicitacaoHash !== hash) throw new AppError(409, 'Chave já usada com outra confirmação');
      return { pedido: existente, repetido: true };
    }
    const usuario = await db.usuario.findUniqueOrThrow({ where: { id: compradorId } });
    if (usuario.versaoCarrinho !== dados.versaoCarrinho) throw new AppError(409, 'Seu carrinho mudou. Atualize antes de confirmar.');
    const endereco = await db.endereco.findFirst({ where: { id: dados.enderecoId, usuarioId: compradorId } });
    if (!endereco) throw new AppError(404, 'Endereço não encontrado');
    const itens = await db.itemCarrinho.findMany({ where: { compradorId }, include: { produto: true }, orderBy: { produtoId: 'asc' } });
    if (!itens.length) throw new AppError(409, 'Carrinho vazio');
    const total = itens.reduce((soma, item) => soma + item.produto.precoCentavos * item.quantidade, 0);
    if (!Number.isSafeInteger(total) || total > 2147483647) throw new AppError(422, 'Valor do pedido acima do limite');
    if (total !== dados.totalEsperadoCentavos) throw new AppError(409, 'O preço mudou. Atualize o carrinho e confira o total.');
    for (const item of itens) {
      const alteracao = await db.produto.updateMany({
        where: { id: item.produtoId, ativo: true, quantidadeEstoque: { gte: item.quantidade } },
        data: { quantidadeEstoque: { decrement: item.quantidade } },
      });
      if (alteracao.count !== 1) throw new AppError(409, `Estoque insuficiente para ${item.produto.titulo}`);
    }
    const { usuarioId: _usuarioId, ...enderecoEntrega } = endereco;
    const pedido = await db.pedido.create({ data: {
      compradorId, chaveIdempotencia: chave, solicitacaoHash: hash,
      totalCentavos: total, status: 'CONFIRMADO', metodoPagamento: dados.metodoPagamento, enderecoEntrega,
      itens: { create: itens.map(item => ({ produtoId: item.produtoId, quantidade: item.quantidade,
        precoUnitarioCentavos: item.produto.precoCentavos, tituloProduto: item.produto.titulo, idArtesao: item.produto.idArtesao })) },
    }, include: { itens: true } });
    await db.itemCarrinho.deleteMany({ where: { compradorId } });
    await db.usuario.update({ where: { id: compradorId }, data: { versaoCarrinho: { increment: 1 } } });
    return { pedido, repetido: false };
  });
}

export const listarPedidos = (compradorId: string) => prisma.pedido.findMany({
  where: { compradorId }, include: { itens: true }, orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }], take: 100,
});
