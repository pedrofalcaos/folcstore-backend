import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

let app: Express, prisma: PrismaClient, pasta: string, artesaoId: string, categoriaId: string;
const endereco = { cep: '50000-000', rua: 'Rua de teste', numero: '10', bairro: 'Centro', complemento: '', cidade: 'Recife', estado: 'PE' };
before(async () => {
  pasta = await mkdtemp(path.join(tmpdir(), 'folcstore-compra-'));
  process.env.DATABASE_URL = `file:${path.join(pasta, 'test.db').replaceAll('\\', '/')}`;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/migrate.ts'], { env: process.env, stdio: 'pipe' });
  ({ app } = await import('../src/app'));
  ({ prisma } = await import('../src/config/prisma'));
  artesaoId = (await prisma.usuario.create({ data: { nome: 'Artesão teste', email: 'artesao@example.com', senhaHash: 'teste', perfil: 'ARTESAO' } })).id;
  categoriaId = (await prisma.categoria.create({ data: { nome: 'Cerâmica' } })).id;
});
after(async () => {
  await prisma?.$disconnect();
  if (pasta) await rm(pasta, { recursive: true, force: true });
});

function token(id: string) {
  return jwt.sign({}, process.env.JWT_SECRET!, { subject: id, issuer: 'folcstore-backend', audience: 'folcstore', expiresIn: '1h' });
}
async function comprador() {
  const usuario = await prisma.usuario.create({ data: { nome: 'Comprador teste', email: `${randomUUID()}@example.com`, senhaHash: 'teste', perfil: 'COMPRADOR', enderecos: { create: endereco } }, include: { enderecos: true } });
  return { id: usuario.id, token: token(usuario.id), enderecoId: usuario.enderecos[0].id };
}
async function produto(estoque = 5) {
  return prisma.produto.create({ data: { titulo: 'Vaso de teste', descricao: 'Vaso artesanal para testes de compra', tecnica: 'Barro', regiaoProducao: 'Olinda', precoCentavos: 1250, quantidadeEstoque: estoque, idArtesao: artesaoId, categoriaId } });
}
async function adicionar(cliente: Awaited<ReturnType<typeof comprador>>, produtoId: string, quantidade = 1) {
  return (await request(app).put(`/api/carrinho/itens/${produtoId}`).auth(cliente.token, { type: 'bearer' }).send({ quantidade }).expect(200)).body;
}
function dados(cliente: Awaited<ReturnType<typeof comprador>>, carrinho: { versao: number; totalCentavos: number }) {
  return { enderecoId: cliente.enderecoId, metodoPagamento: 'PIX', versaoCarrinho: carrinho.versao, totalEsperadoCentavos: carrinho.totalCentavos };
}
function confirmar(cliente: Awaited<ReturnType<typeof comprador>>, corpo: object, chave = randomUUID()) {
  return request(app).post('/api/pedidos').auth(cliente.token, { type: 'bearer' }).set('Idempotency-Key', chave).send(corpo);
}

test('PI4-188: carrinho persiste, define quantidades e fica isolado por comprador', async () => {
  const a = await comprador(), b = await comprador(), p = await produto();
  await request(app).get('/api/carrinho').expect(401);
  await request(app).get('/api/carrinho').auth(token(artesaoId), { type: 'bearer' }).expect(403);
  await adicionar(a, p.id, 2);
  const salvo = await request(app).get('/api/carrinho').auth(a.token, { type: 'bearer' }).expect(200);
  assert.equal(salvo.body.itens[0].quantidade, 2);
  assert.equal(salvo.body.totalCentavos, 2500);
  const vazio = await request(app).get('/api/carrinho').auth(b.token, { type: 'bearer' }).expect(200);
  assert.deepEqual(vazio.body.itens, []);
  await request(app).put(`/api/carrinho/itens/${p.id}`).auth(a.token, { type: 'bearer' }).send({ quantidade: 0 }).expect(400);
  await request(app).put(`/api/carrinho/itens/${p.id}`).auth(a.token, { type: 'bearer' }).send({ quantidade: 99 }).expect(409);
  const removido = await request(app).delete(`/api/carrinho/itens/${p.id}`).auth(a.token, { type: 'bearer' }).expect(200);
  assert.deepEqual(removido.body.itens, []);
});

test('PI4-189/190: confirma total do banco, salva snapshots e limpa carrinho', async () => {
  const a = await comprador(), p = await produto();
  const carrinho = await adicionar(a, p.id, 2);
  const res = await confirmar(a, dados(a, carrinho)).expect(201);
  assert.equal(res.body.totalCentavos, 2500);
  assert.equal(res.body.status, 'CONFIRMADO');
  assert.equal(res.body.enderecoEntrega.rua, endereco.rua);
  assert.equal(res.body.itens[0].precoUnitarioCentavos, 1250);
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).quantidadeEstoque, 3);
  assert.equal(await prisma.itemCarrinho.count({ where: { compradorId: a.id } }), 0);
  await prisma.produto.update({ where: { id: p.id }, data: { precoCentavos: 9999, titulo: 'Outro título' } });
  await request(app).delete(`/api/enderecos/${a.enderecoId}`).auth(a.token, { type: 'bearer' }).expect(204);
  const historico = await request(app).get('/api/pedidos').auth(a.token, { type: 'bearer' }).expect(200);
  assert.equal(historico.body[0].itens[0].precoUnitarioCentavos, 1250);
  assert.equal(historico.body[0].itens[0].tituloProduto, p.titulo);
  assert.equal(historico.body[0].enderecoEntrega.rua, endereco.rua);
});

test('PI4-190: compradores simultâneos disputam a última unidade; só um vence', async () => {
  const a = await comprador(), b = await comprador(), p = await produto(1);
  const ca = await adicionar(a, p.id), cb = await adicionar(b, p.id);
  const respostas = await Promise.all([confirmar(a, dados(a, ca)), confirmar(b, dados(b, cb))]);
  assert.deepEqual(respostas.map(r => r.status).sort(), [201, 409], JSON.stringify(respostas.map(r => r.body)));
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).quantidadeEstoque, 0);
  assert.equal(await prisma.itemPedido.count({ where: { produtoId: p.id } }), 1);
});

test('Idempotência: duplo clique e repetição depois da resposta perdida não duplicam pedido', async () => {
  const a = await comprador(), p = await produto();
  const carrinho = await adicionar(a, p.id);
  const corpo = dados(a, carrinho), chave = randomUUID();
  const respostas = await Promise.all([confirmar(a, corpo, chave), confirmar(a, corpo, chave)]);
  assert.deepEqual(respostas.map(r => r.status).sort(), [200, 201], JSON.stringify(respostas.map(r => r.body)));
  assert.equal(respostas[0].body.id, respostas[1].body.id);
  const repetida = await confirmar(a, corpo, chave).expect(200);
  assert.equal(repetida.body.id, respostas[0].body.id);
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).quantidadeEstoque, 4);
  await confirmar(a, { ...corpo, metodoPagamento: 'CARTAO' }, chave).expect(409);
  assert.equal(await prisma.pedido.count({ where: { compradorId: a.id } }), 1);
});

test('Rollback: falha no segundo produto reverte baixa do primeiro e preserva carrinho', async () => {
  const a = await comprador();
  const produtos = [await produto(), await produto()].sort((a, b) => a.id.localeCompare(b.id));
  await adicionar(a, produtos[0].id);
  const carrinho = await adicionar(a, produtos[1].id);
  await prisma.produto.update({ where: { id: produtos[1].id }, data: { quantidadeEstoque: 0 } });
  await confirmar(a, dados(a, carrinho)).expect(409);
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: produtos[0].id } })).quantidadeEstoque, 5);
  assert.equal(await prisma.pedido.count({ where: { compradorId: a.id } }), 0);
  assert.equal(await prisma.itemCarrinho.count({ where: { compradorId: a.id } }), 2);
});

test('Recusa preço alterado, carrinho desatualizado, corpo adulterado e endereço de outro comprador', async () => {
  const a = await comprador(), b = await comprador(), p = await produto();
  const antigo = await adicionar(a, p.id);
  const atual = await adicionar(a, p.id, 2);
  await confirmar(a, dados(a, antigo)).expect(409);
  await confirmar(a, { ...dados(a, atual), precoCentavos: 1 }).expect(400);
  await confirmar(a, { ...dados(a, atual), enderecoId: b.enderecoId }).expect(404);
  await prisma.produto.update({ where: { id: p.id }, data: { precoCentavos: 1300 } });
  await confirmar(a, dados(a, atual)).expect(409);
  assert.equal(await prisma.pedido.count({ where: { compradorId: a.id } }), 0);
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).quantidadeEstoque, 5);
  await request(app).delete(`/api/enderecos/${a.enderecoId}`).auth(b.token, { type: 'bearer' }).expect(404);
  const historicoB = await request(app).get('/api/pedidos').auth(b.token, { type: 'bearer' }).expect(200);
  assert.deepEqual(historicoB.body, []);
});
