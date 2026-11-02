import { RequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { AppError } from '../errors/AppError';
import { carrinhoService } from '../services/carrinho.service';
import { confirmarPedido, listarPedidos } from '../services/pedido.service';
import { checkoutSchema, enderecoSchema, itemCarrinhoSchema } from '../validators/compra.schema';

const idSchema = z.string().uuid();
export const buscarCarrinho: RequestHandler = async (req, res) => { res.json(await carrinhoService.buscar(req.usuario!.id)); };
export const definirItem: RequestHandler = async (req, res) => {
  const { produtoId, quantidade } = itemCarrinhoSchema.parse({ ...req.body, produtoId: req.params.produtoId });
  res.json(await carrinhoService.definirItem(req.usuario!.id, produtoId, quantidade));
};
export const removerItem: RequestHandler = async (req, res) => {
  res.json(await carrinhoService.remover(req.usuario!.id, idSchema.parse(req.params.produtoId)));
};
export const limparCarrinho: RequestHandler = async (req, res) => { res.json(await carrinhoService.remover(req.usuario!.id)); };
export const checkout: RequestHandler = async (req, res) => {
  const chave = idSchema.parse(req.headers['idempotency-key']);
  const resultado = await confirmarPedido(req.usuario!.id, chave, checkoutSchema.parse(req.body));
  res.status(resultado.repetido ? 200 : 201).json(resultado.pedido);
};
export const pedidos: RequestHandler = async (req, res) => { res.json(await listarPedidos(req.usuario!.id)); };
export const enderecos: RequestHandler = async (req, res) => {
  res.json(await prisma.endereco.findMany({ where: { usuarioId: req.usuario!.id }, orderBy: { id: 'asc' } }));
};
export const adicionarEndereco: RequestHandler = async (req, res) => {
  const endereco = enderecoSchema.parse(req.body);
  if (await prisma.endereco.count({ where: { usuarioId: req.usuario!.id } }) >= 20) throw new AppError(422, 'Limite de 20 endereços');
  res.status(201).json(await prisma.endereco.create({ data: { ...endereco, usuarioId: req.usuario!.id } }));
};
export const removerEndereco: RequestHandler = async (req, res) => {
  const resultado = await prisma.endereco.deleteMany({ where: { id: idSchema.parse(req.params.id), usuarioId: req.usuario!.id } });
  if (!resultado.count) throw new AppError(404, 'Endereço não encontrado');
  res.sendStatus(204);
};
