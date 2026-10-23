import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Perfil } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const senha = process.env.SEED_PASSWORD;
  if (!senha || senha.length < 8 || Buffer.byteLength(senha) > 72) {
    throw new Error('Defina SEED_PASSWORD no .env (mínimo 8 caracteres, máximo 72 bytes)');
  }
  const senhaHash = await bcrypt.hash(senha, 12);
  const contas = [
    { nome: 'Artesã de demonstração', email: 'artesao@example.com', perfil: Perfil.ARTESAO },
    { nome: 'Comprador de demonstração', email: 'comprador@example.com', perfil: Perfil.COMPRADOR },
    { nome: 'Admin de demonstração', email: 'admin@example.com', perfil: Perfil.ADMIN },
  ];
  for (const conta of contas) {
    await prisma.usuario.upsert({ where: { email: conta.email }, update: {}, create: { ...conta, senhaHash } });
  }
  const artesao = await prisma.usuario.findUniqueOrThrow({ where: { email: contas[0].email } });
  const ceramica = await prisma.categoria.upsert({ where: { nome: 'Cerâmica' }, update: {}, create: { nome: 'Cerâmica' } });
  const madeira = await prisma.categoria.upsert({ where: { nome: 'Madeira' }, update: {}, create: { nome: 'Madeira' } });
  const produtos = [
    { id: '00000000-0000-4000-8000-000000000001', titulo: 'Vaso de barro', descricao: 'Vaso artesanal feito em barro e modelado à mão.', tecnica: 'Modelagem em barro', regiaoProducao: 'Tracunhaém', categoriaId: ceramica.id, precoCentavos: 8990 },
    { id: '00000000-0000-4000-8000-000000000002', titulo: 'Prato decorativo', descricao: 'Prato artesanal decorativo pintado à mão.', tecnica: 'Modelagem em barro', regiaoProducao: 'Caruaru', categoriaId: ceramica.id, precoCentavos: 6500 },
    { id: '00000000-0000-4000-8000-000000000003', titulo: 'Escultura de madeira', descricao: 'Escultura artesanal entalhada em madeira.', tecnica: 'Entalhe', regiaoProducao: 'Olinda', categoriaId: madeira.id, precoCentavos: 12000 },
  ];
  for (const produto of produtos) {
    await prisma.produto.upsert({ where: { id: produto.id }, update: {}, create: { ...produto, idArtesao: artesao.id, quantidadeEstoque: 5, tipo: 'LOTE' } });
  }
  console.log('Seed concluído: 3 contas, 2 categorias e 3 produtos de demonstração. Registros existentes preservados.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
