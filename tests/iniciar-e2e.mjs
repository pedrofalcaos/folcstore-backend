// Banco temporário e API isolada usados somente pelo teste de navegador.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const pasta = await mkdtemp(path.join(tmpdir(), 'folcstore-browser-'));
process.env.DATABASE_URL = `file:${path.join(pasta, 'test.db').replaceAll('\\', '/')}`;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.PORT = '3103';
process.env.FRONTEND_URL = 'http://127.0.0.1:3100';
execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/migrate.ts'], { env: process.env, stdio: 'inherit' });
const require = createRequire(path.join(raiz, 'package.json'));
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const artesao = await db.usuario.create({ data: { nome: 'Artesão E2E', email: 'artesao-e2e@example.com', senhaHash: 'sem-login', perfil: 'ARTESAO' } });
const categoria = await db.categoria.create({ data: { nome: 'Cerâmica' } });
await db.produto.create({ data: { titulo: 'Vaso do fluxo local', descricao: 'Vaso artesanal para teste completo de compra', tecnica: 'Barro', regiaoProducao: 'Olinda', precoCentavos: 1250, quantidadeEstoque: 5, categoriaId: categoria.id, idArtesao: artesao.id } });
await db.$disconnect();
const servidor = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/server.ts'], { env: process.env, stdio: 'inherit' });
let encerrando = false;
async function encerrar() {
  if (encerrando) return;
  encerrando = true;
  if (servidor.exitCode === null) {
    // Encerra a árvore que este launcher criou (necessário no Windows com tsx).
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(servidor.pid), '/T', '/F']);
    else servidor.kill('SIGTERM');
  }
  await rm(pasta, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  process.exit(0);
}
process.once('SIGINT', encerrar);
process.once('SIGTERM', encerrar);
servidor.once('exit', () => { if (!encerrando) void encerrar(); });
