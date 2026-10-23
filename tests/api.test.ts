import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

let app: Express;
let prisma: PrismaClient;
let pastaTemporaria: string;
let tokenArtesao: string;
let tokenOutro: string;
let tokenComprador: string;
let artesaoId: string;
let produtoId: string;
let categoriaId: string;
const senha = 'SenhaTeste123!';

before(async () => {
  pastaTemporaria = await mkdtemp(path.join(tmpdir(), 'folcstore-test-'));
  process.env.DATABASE_URL = `file:${path.join(pastaTemporaria, 'test.db').replaceAll('\\', '/')}`;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/migrate.ts'], {
    env: process.env, stdio: 'pipe',
  });
  ({ app } = await import('../src/app'));
  ({ prisma } = await import('../src/config/prisma'));
  categoriaId = (await prisma.categoria.create({ data: { nome: 'Cerâmica' } })).id;
});

after(async () => {
  await prisma?.$disconnect();
  // Só remove o diretório isolado criado por este teste, nunca o banco local.
  if (pastaTemporaria) await rm(pastaTemporaria, { recursive: true, force: true });
});

function produto() {
  return { titulo: 'Vaso artesanal', descricao: 'Vaso feito manualmente em barro.', tecnica: 'Barro',
    regiaoProducao: 'Olinda', precoCentavos: 8990, quantidadeEstoque: 3, tipo: 'LOTE', categoriaId };
}

test('US01: health consulta o banco e categorias são públicas', async () => {
  const res = await request(app).get('/api/health').expect(200);
  assert.equal(res.body.banco, 'conectado');
  const categorias = await request(app).get('/api/categorias').expect(200);
  assert.equal(categorias.body[0].id, categoriaId);
});

test('US02: cadastro, perfis e senha armazenada com hash', async () => {
  for (const [email, perfil] of [['artesao@example.com', 'ARTESAO'], ['outro@example.com', 'ARTESAO'], ['comprador@example.com', 'COMPRADOR']]) {
    const res = await request(app).post('/api/auth/register').send({ nome: 'Pessoa Teste', email, senha, perfil }).expect(201);
    assert.ok(res.body.token);
    assert.equal(res.body.usuario.senhaHash, undefined);
    if (email.startsWith('artesao')) { tokenArtesao = res.body.token; artesaoId = res.body.usuario.id; }
    else if (email.startsWith('outro')) tokenOutro = res.body.token;
    else tokenComprador = res.body.token;
  }
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: artesaoId } });
  assert.notEqual(usuario.senhaHash, senha);
  assert.ok(usuario.senhaHash.startsWith('$2'));
});

test('US02: rejeita admin público, senha curta e e-mail duplicado', async () => {
  await request(app).post('/api/auth/register').send({ nome: 'Admin', email: 'admin@example.com', senha, perfil: 'ADMIN' }).expect(400);
  await request(app).post('/api/auth/register').send({ nome: 'Teste', email: 'teste@example.com', senha: '123' }).expect(400);
  await request(app).post('/api/auth/register').send({ nome: 'Outro', email: ' ARTESAO@example.com ', senha }).expect(409);
});

test('US02: login, perfil e token inválido/expirado', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'ARTESAO@example.com', senha }).expect(200);
  const me = await request(app).get('/api/auth/me').auth(login.body.token, { type: 'bearer' }).expect(200);
  assert.equal(me.body.id, artesaoId);
  await request(app).post('/api/auth/login').send({ email: 'artesao@example.com', senha: 'Incorreta123' }).expect(401);
  await request(app).get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').auth('invalido', { type: 'bearer' }).expect(401);
  const expirado = jwt.sign({}, process.env.JWT_SECRET!, { subject: artesaoId, expiresIn: -1, issuer: 'folcstore-backend', audience: 'folcstore' });
  await request(app).get('/api/auth/me').auth(expirado, { type: 'bearer' }).expect(401);
});

test('US03: só artesão pode cadastrar; proprietário vem do token', async () => {
  await request(app).post('/api/produtos').send(produto()).expect(401);
  await request(app).post('/api/produtos').auth(tokenComprador, { type: 'bearer' }).send(produto()).expect(403);
  await request(app).post('/api/produtos').auth(tokenArtesao, { type: 'bearer' }).send({ ...produto(), idArtesao: 'outro' }).expect(400);
  const res = await request(app).post('/api/produtos').auth(tokenArtesao, { type: 'bearer' }).send(produto()).expect(201);
  produtoId = res.body.id;
  assert.equal(res.body.idArtesao, artesaoId);
  assert.equal(res.body.artesao.email, undefined);
  assert.equal(res.body.artesao.senhaHash, undefined);
});

test('US03: valida preço, estoque, categoria e peça única', async () => {
  for (const dados of [
    { ...produto(), precoCentavos: -1 }, { ...produto(), precoCentavos: 10.5 },
    { ...produto(), quantidadeEstoque: -1 }, { ...produto(), tipo: 'UNICO', quantidadeEstoque: 2 },
    { ...produto(), categoriaId: '00000000-0000-4000-8000-000000000099' },
  ]) {
    await request(app).post('/api/produtos').auth(tokenArtesao, { type: 'bearer' }).send(dados).expect(400);
  }
});

test('US03: filtros combinados, paginação e detalhe', async () => {
  await request(app).post('/api/produtos').auth(tokenArtesao, { type: 'bearer' }).send({ ...produto(), titulo: 'Prato decorativo', regiaoProducao: 'Recife' }).expect(201);
  const lista = await request(app).get('/api/produtos').query({ busca: 'Vaso', tecnica: 'Barro', regiao: 'Olinda', categoriaId, idArtesao: artesaoId, limite: 1 }).expect(200);
  assert.equal(lista.body.total, 1);
  assert.equal(lista.body.dados[0].id, produtoId);
  const pagina = await request(app).get('/api/produtos?pagina=2&limite=1').expect(200);
  assert.equal(pagina.body.total, 2);
  assert.equal(pagina.body.dados.length, 1);
  await request(app).get('/api/produtos?limite=1000').expect(400);
  await request(app).get(`/api/produtos/${produtoId}`).expect(200);
  await request(app).get('/api/produtos/00000000-0000-4000-8000-000000000099').expect(404);
});

test('US03: impede edição e exclusão por outro artesão', async () => {
  await request(app).put(`/api/produtos/${produtoId}`).auth(tokenOutro, { type: 'bearer' }).send(produto()).expect(403);
  await request(app).delete(`/api/produtos/${produtoId}`).auth(tokenOutro, { type: 'bearer' }).expect(403);
  const res = await request(app).put(`/api/produtos/${produtoId}`).auth(tokenArtesao, { type: 'bearer' }).send({ ...produto(), precoCentavos: 9500 }).expect(200);
  assert.equal(res.body.precoCentavos, 9500);
});

test('US03: exclusão lógica preserva registro e oculta do catálogo', async () => {
  await request(app).delete(`/api/produtos/${produtoId}`).auth(tokenArtesao, { type: 'bearer' }).expect(204);
  await request(app).get(`/api/produtos/${produtoId}`).expect(404);
  const lista = await request(app).get('/api/produtos').expect(200);
  assert.equal(lista.body.total, 1);
  const salvo = await prisma.produto.findUniqueOrThrow({ where: { id: produtoId } });
  assert.equal(salvo.ativo, false);
});

test('Respostas de erro: JSON malformado e rota desconhecida', async () => {
  await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{').expect(400);
  await request(app).get('/nao-existe').expect(404);
});
