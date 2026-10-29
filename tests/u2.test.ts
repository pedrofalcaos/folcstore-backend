import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync, ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

let app: Express, prisma: PrismaClient, filho: ChildProcess, pasta: string, url: string, id: string, artesaoId: string;
before(async () => {
  pasta = await mkdtemp(path.join(tmpdir(), 'folcstore-u2-'));
  process.env.DATABASE_URL = `file:${path.join(pasta, 'test.db').replaceAll('\\', '/')}`;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.RECOMMENDER_TIMEOUT_MS = '1000';
  const reserva = createServer();
  await new Promise<void>(resolve => reserva.listen(0, '127.0.0.1', resolve));
  const port = (reserva.address() as { port: number }).port;
  await new Promise<void>(resolve => reserva.close(() => resolve()));
  url = process.env.RECOMMENDER_URL = `http://127.0.0.1:${port}`;
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/migrate.ts'], { env: process.env, stdio: 'pipe' });
  ({ app } = await import('../src/app'));
  ({ prisma } = await import('../src/config/prisma'));
  const usuario = await prisma.usuario.create({ data: { nome: 'Teste', email: 'teste@example.com', senhaHash: 'nao-utilizado', perfil: 'ARTESAO' } });
  artesaoId = usuario.id;
  const categoria = await prisma.categoria.create({ data: { nome: 'Barro' } });
  for (let n = 0; n < 3; n++) {
    const p = await prisma.produto.create({ data: { titulo: `Peça ${n}`, descricao: `Peça artesanal de barro ${n}`, tecnica: 'Barro', regiaoProducao: 'Olinda', precoCentavos: 1000, quantidadeEstoque: 1, idArtesao: usuario.id, categoriaId: categoria.id } });
    if (n === 0) id = p.id;
  }
  filho = spawn(process.env.PYTHON || 'python', ['services/recomendador/server.py', '--port', String(port), '--workers', '2'], { stdio: 'ignore' });
  let erroSpawn: Error | undefined;
  filho.on('error', erro => { erroSpawn = erro; });
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (erroSpawn) throw erroSpawn;
    try { if ((await fetch(`${url}/health`)).ok) return; } catch { /* aguardando inicialização */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Python não iniciou');
});
after(async () => {
  if (filho && filho.exitCode === null) {
    const terminou = new Promise(resolve => filho.once('exit', resolve));
    filho.kill();
    await terminou;
  }
  await prisma?.$disconnect();
  if (pasta) await rm(pasta, { recursive: true, force: true });
});

test('U2: Express consulta serviço Python real e preserva IDs do banco', async () => {
  const seq = await request(app).get('/api/recomendacoes').query({ produtoId: id, modo: 'sequencial' }).expect(200);
  const par = await request(app).get('/api/recomendacoes').query({ produtoId: id, modo: 'paralelo' }).expect(200);
  assert.deepEqual(seq.body.resultados, par.body.resultados);
  assert.equal(seq.body.resultados[0].itens.length, 2);
  for (const item of seq.body.resultados[0].itens) {
    assert.equal(item.produtoId, item.produto.id);
    assert.notEqual(item.produtoId, id);
  }
});
test('U2: valida parâmetros e protocolo HTTP Python', async () => {
  await request(app).get('/api/recomendacoes?produtoId=invalido').expect(400);
  await request(app).get('/api/recomendacoes?produtoId=00000000-0000-4000-8000-000000000099').expect(404);
  const invalido = await fetch(`${url}/recomendacoes`, { method: 'POST', body: '{}' });
  assert.equal(invalido.status, 400);
});
test('U2: lote exige artesão e calcula sugestões para todas as suas origens', async () => {
  await request(app).post('/api/recomendacoes/lote').send({}).expect(401);
  const token = jwt.sign({}, process.env.JWT_SECRET!, { subject: artesaoId, expiresIn: '1h', issuer: 'folcstore-backend', audience: 'folcstore' });
  const res = await request(app).post('/api/recomendacoes/lote').auth(token, { type: 'bearer' }).send({ modo: 'paralelo' }).expect(200);
  assert.equal(res.body.resultados.length, 3);
  const pagina = await request(app).get('/demonstracao').expect(200);
  assert.ok(pagina.text.includes('Ver sugestões'));
});
test('U2: falha do serviço remoto retorna 503 e mantém catálogo disponível', async () => {
  const terminou = new Promise(resolve => filho.once('exit', resolve));
  filho.kill();
  await terminou;
  await request(app).get('/api/recomendacoes').query({ produtoId: id }).expect(503);
  await request(app).get('/api/produtos').expect(200);
});
