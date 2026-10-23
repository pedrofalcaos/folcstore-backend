import 'dotenv/config';
import path from 'node:path';
import { closeSync, openSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const url = process.env.DATABASE_URL;
if (!url?.startsWith('file:')) throw new Error('DATABASE_URL deve usar um arquivo SQLite (file:...)');
const arquivo = path.resolve('prisma', url.slice(5));
mkdirSync(path.dirname(arquivo), { recursive: true });
// No Windows, o engine pode falhar quando o arquivo ainda não existe.
// Modo append cria o arquivo, mas preserva integralmente bancos existentes.
closeSync(openSync(arquivo, 'a'));
execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
  env: process.env, stdio: 'inherit',
});
