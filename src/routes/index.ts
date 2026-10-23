import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as auth from '../controllers/auth.controller';
import * as produto from '../controllers/produto.controller';
import { autenticar, permitirPerfis } from '../middlewares/auth.middleware';
import { prisma } from '../config/prisma';

export const routes = Router();
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
routes.get('/produtos', produto.listar);
routes.get('/produtos/:id', produto.buscar);
routes.post('/produtos', autenticar, permitirPerfis('ARTESAO'), produto.criar);
routes.put('/produtos/:id', autenticar, permitirPerfis('ARTESAO'), produto.atualizar);
routes.delete('/produtos/:id', autenticar, permitirPerfis('ARTESAO'), produto.excluir);
