import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

async function iniciar() {
  await prisma.$connect();
  const server = app.listen(env.PORT, '127.0.0.1', () => {
    console.log(`FolcStore backend: http://localhost:${env.PORT}/api/health`);
  });
  server.on('error', async error => {
    console.error('Não foi possível iniciar o servidor:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  });
  for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(sinal, () => {
      server.close(async () => { await prisma.$disconnect(); process.exit(0); });
    });
  }
}

iniciar().catch(async error => {
  console.error('Erro ao conectar com o banco:', error.message);
  await prisma.$disconnect();
  process.exit(1);
});
