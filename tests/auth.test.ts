import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { registerSchema, loginSchema } from '../src/validators/auth.schema';
import { AppError } from '../src/errors/AppError';
import type { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;
let authService: typeof import('../src/services/auth.service').authService;
let autenticar: typeof import('../src/middlewares/auth.middleware').autenticar;
let permitirPerfis: typeof import('../src/middlewares/auth.middleware').permitirPerfis;
let env: typeof import('../src/config/env').env;
let pastaTemporaria: string;
const senhaValida = 'SenhaForte123!';

before(async () => {
  pastaTemporaria = await mkdtemp(path.join(tmpdir(), 'folcstore-auth-test-'));
  process.env.DATABASE_URL = `file:${path.join(pastaTemporaria, 'test-auth.db').replaceAll('\\', '/')}`;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');

  // Executa as migrações no banco SQLite isolado do teste
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/migrate.ts'], {
    env: process.env,
    stdio: 'pipe',
  });

  // Importa dinamicamente após configurar as variáveis de ambiente
  ({ env } = await import('../src/config/env'));
  ({ prisma } = await import('../src/config/prisma'));
  ({ authService } = await import('../src/services/auth.service'));
  ({ autenticar, permitirPerfis } = await import('../src/middlewares/auth.middleware'));
});

after(async () => {
  await prisma?.$disconnect();
  if (pastaTemporaria) {
    await rm(pastaTemporaria, { recursive: true, force: true });
  }
});

test('Validação (auth.schema): rejeita senhas que não atendem aos critérios de senha forte', () => {
  // Menos de 8 caracteres
  const curta = registerSchema.safeParse({ nome: 'Teste', email: 't@ex.com', senha: '123' });
  assert.equal(curta.success, false);
  assert.ok(curta.error?.issues.some(i => i.message.includes('8 caracteres')));

  // Sem maiúscula
  const semMaiuscula = registerSchema.safeParse({ nome: 'Teste', email: 't@ex.com', senha: 'senhasimples123' });
  assert.equal(semMaiuscula.success, false);
  assert.ok(semMaiuscula.error?.issues.some(i => i.message.includes('maiúscula')));

  // Sem número
  const semNumero = registerSchema.safeParse({ nome: 'Teste', email: 't@ex.com', senha: 'SenhaSemNumero' });
  assert.equal(semNumero.success, false);
  assert.ok(semNumero.error?.issues.some(i => i.message.includes('número')));

  // Senha válida
  const valida = registerSchema.safeParse({ nome: 'Teste', email: 't@ex.com', senha: senhaValida });
  assert.equal(valida.success, true);
});

test('Validação (auth.schema): validação matemática de CPF e rejeição de ADMIN', () => {
  // CPF inválido (todos os números iguais ou dígitos incorretos)
  const cpfInvalido = registerSchema.safeParse({
    nome: 'Teste', email: 't@ex.com', senha: senhaValida, cpf: '111.111.111-11',
  });
  assert.equal(cpfInvalido.success, false);
  assert.ok(cpfInvalido.error?.issues.some(i => i.message.includes('CPF')));

  // CPF válido (remove pontuação e valida)
  const cpfValido = registerSchema.safeParse({
    nome: 'Teste', email: 't@ex.com', senha: senhaValida, cpf: '529.982.247-25',
  });
  assert.equal(cpfValido.success, true);
  if (cpfValido.success) {
    assert.equal(cpfValido.data.cpf, '52998224725');
  }

  // Bloqueio de ADMIN público no cadastro
  const admin = registerSchema.safeParse({
    nome: 'Admin', email: 'adm@ex.com', senha: senhaValida, perfil: 'ADMIN' as any,
  });
  assert.equal(admin.success, false);
});

test('Serviço (auth.service): registro gera hash bcrypt, mascara senha e emite JWT com claims', async () => {
  const dados = registerSchema.parse({
    nome: 'Artesão Teste',
    email: 'ARTESAO@example.com',
    senha: senhaValida,
    perfil: 'ARTESAO',
    telefone: '81999998888',
  });

  const sessao = await authService.registrar(dados);

  // 1. Não vaza o hash da senha
  assert.equal((sessao.usuario as any).senhaHash, undefined);
  assert.equal(sessao.usuario.email, 'artesao@example.com'); // normalizado para lowercase
  assert.equal(sessao.usuario.perfil, 'ARTESAO');

  // 2. Verifica hash no banco
  const usuarioBanco = await prisma.usuario.findUniqueOrThrow({ where: { id: sessao.usuario.id } });
  assert.notEqual(usuarioBanco.senhaHash, senhaValida);
  assert.ok(usuarioBanco.senhaHash.startsWith('$2'));

  // 3. Verifica o token JWT gerado e seus claims
  const decoded = jwt.verify(sessao.token, env.JWT_SECRET, {
    issuer: 'folcstore-backend',
    audience: 'folcstore',
  }) as jwt.JwtPayload;

  assert.equal(decoded.sub, sessao.usuario.id);
  assert.equal(decoded.perfil, 'ARTESAO');
  assert.equal(decoded.email, 'artesao@example.com');
  assert.equal(decoded.nome, 'Artesão Teste');
});

test('Serviço (auth.service): rejeita registro com e-mail duplicado (409 Conflict)', async () => {
  const dados = registerSchema.parse({
    nome: 'Outro Usuário',
    email: 'artesao@example.com', // Já cadastrado no teste anterior
    senha: senhaValida,
  });

  await assert.rejects(
    async () => authService.registrar(dados),
    (err: any) => err instanceof AppError && err.status === 409
  );
});

test('Serviço (auth.service): login com credenciais válidas e rejeição de senha incorreta', async () => {
  // Login correto
  const dadosLogin = loginSchema.parse({ email: 'artesao@example.com', senha: senhaValida });
  const sessao = await authService.entrar(dadosLogin);
  assert.ok(sessao.token);
  assert.equal(sessao.usuario.email, 'artesao@example.com');

  // Senha incorreta -> 401 Unauthorized
  const loginErrado = loginSchema.parse({ email: 'artesao@example.com', senha: 'SenhaErrada123!' });
  await assert.rejects(
    async () => authService.entrar(loginErrado),
    (err: any) => err instanceof AppError && err.status === 401
  );

  // E-mail inexistente -> 401 Unauthorized
  const emailInexistente = loginSchema.parse({ email: 'inexistente@example.com', senha: senhaValida });
  await assert.rejects(
    async () => authService.entrar(emailInexistente),
    (err: any) => err instanceof AppError && err.status === 401
  );
});

test('Middleware (auth.middleware): validação de token Bearer e controle de acesso RBAC', async () => {
  // 1. Cadastra um comprador
  const comprador = await authService.registrar({
    nome: 'Comprador Teste',
    email: 'comprador@example.com',
    senha: senhaValida,
    perfil: 'COMPRADOR',
    telefone: '',
    enderecos: [],
  });

  // 2. Testa requisição sem header Authorization -> 401
  const reqSemHeader: any = { headers: {} };
  await assert.rejects(
    async () => autenticar(reqSemHeader, {} as any, () => {}),
    (err: any) => err instanceof AppError && err.status === 401 && err.message.includes('Bearer')
  );

  // 3. Testa requisição com token expirado -> 401
  const tokenExpirado = jwt.sign({}, env.JWT_SECRET, {
    subject: comprador.usuario.id,
    expiresIn: -1,
    issuer: 'folcstore-backend',
    audience: 'folcstore',
  });
  const reqTokenExpirado: any = { headers: { authorization: `Bearer ${tokenExpirado}` } };
  await assert.rejects(
    async () => autenticar(reqTokenExpirado, {} as any, () => {}),
    (err: any) => err instanceof AppError && err.status === 401 && err.message.includes('expirado')
  );

  // 4. Testa token válido -> deve injetar req.usuario e chamar next()
  let nextChamado = false;
  const reqValida: any = { headers: { authorization: `Bearer ${comprador.token}` } };
  await autenticar(reqValida, {} as any, () => { nextChamado = true; });
  assert.equal(nextChamado, true);
  assert.equal(reqValida.usuario?.id, comprador.usuario.id);
  assert.equal(reqValida.usuario?.perfil, 'COMPRADOR');

  // 5. Testa RBAC (permitirPerfis)
  // Comprador tentando acessar rota de artesão -> 403
  const guardArtesao = permitirPerfis('ARTESAO');
  assert.throws(
    () => guardArtesao(reqValida, {} as any, () => {}),
    (err: any) => err instanceof AppError && err.status === 403
  );

  // Comprador acessando rota de comprador -> permitido (next chamado)
  let nextComprador = false;
  const guardComprador = permitirPerfis('COMPRADOR');
  guardComprador(reqValida, {} as any, () => { nextComprador = true; });
  assert.equal(nextComprador, true);
});
