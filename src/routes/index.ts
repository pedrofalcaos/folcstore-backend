import { Router } from 'express';
import * as compra from '../controllers/compra.controller';
import { recomendar, recomendarLote } from '../controllers/recomendacao.controller';
import rateLimit from 'express-rate-limit';
import * as auth from '../controllers/auth.controller';
import * as produto from '../controllers/produto.controller';
import { autenticar, permitirPerfis } from '../middlewares/auth.middleware';
import { prisma } from '../config/prisma';
import { z } from 'zod';

export const routes = Router();
const comprador = [autenticar, permitirPerfis('COMPRADOR')];
routes.get('/carrinho', ...comprador, compra.buscarCarrinho);
routes.put('/carrinho/itens/:produtoId', ...comprador, compra.definirItem);
routes.delete('/carrinho/itens/:produtoId', ...comprador, compra.removerItem);
routes.delete('/carrinho', ...comprador, compra.limparCarrinho);
routes.post('/pedidos', ...comprador, compra.checkout);
routes.get('/pedidos', ...comprador, compra.pedidos);
routes.get('/artesao/pedidos', autenticar, permitirPerfis('ARTESAO'), async (req, res) => {
  res.json(await prisma.pedido.findMany({ where: { itens: { some: { idArtesao: req.usuario!.id } } },
    include: { itens: { where: { idArtesao: req.usuario!.id } }, comprador: { select: { nome: true } } },
    orderBy: { criadoEm: 'desc' }, take: 100 }));
});
routes.get('/admin/pedidos', autenticar, permitirPerfis('ADMIN'), async (_req, res) => {
  res.json(await prisma.pedido.findMany({ include: { itens: true, comprador: { select: { nome: true } } }, orderBy: { criadoEm: 'desc' }, take: 100 }));
});
routes.get('/artesaos', async (_req, res) => {
  res.json(await prisma.usuario.findMany({ where: { perfil: 'ARTESAO' }, select: { id: true, nome: true } }));
});
routes.get('/artesaos/:id', async (req, res) => {
  const usuario = await prisma.usuario.findFirst({ where: { id: z.string().uuid().parse(req.params.id), perfil: 'ARTESAO' }, select: { id: true, nome: true } });
  if (!usuario) { res.status(404).json({ erro: 'Artesão não encontrado' }); return; }
  res.json(usuario);
});
routes.get('/enderecos', ...comprador, compra.enderecos);
routes.post('/enderecos', ...comprador, compra.adicionarEndereco);
routes.delete('/enderecos/:id', ...comprador, compra.removerEndereco);
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde 15 minutos.' },
});

routes.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', banco: 'conectado' });
});
routes.post('/auth/register', limiteAuth, auth.registrar);
routes.post('/auth/login', limiteAuth, auth.entrar);
routes.get('/auth/me', autenticar, auth.perfil);
routes.get('/categorias', produto.categorias);
routes.get('/recomendacoes', rateLimit({ windowMs: 60000, limit: 60 }), recomendar);
routes.post('/recomendacoes/lote', autenticar, permitirPerfis('ARTESAO'),
  rateLimit({ windowMs: 60000, limit: 6 }), recomendarLote);
routes.get('/produtos', produto.listar);
routes.get('/produtos/:id', produto.buscar);
routes.post('/produtos', autenticar, permitirPerfis('ARTESAO'), produto.criar);
routes.put('/produtos/:id', autenticar, permitirPerfis('ARTESAO'), produto.atualizar);
routes.delete('/produtos/:id', autenticar, permitirPerfis('ARTESAO'), produto.excluir);
