import express from 'express';
import path from 'node:path';
import cors from 'cors';
import { env } from './config/env';
import { routes } from './routes';
import { errorMiddleware } from './middlewares/error.middleware';

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', routes);
app.get('/demonstracao', (_req, res) => { res.sendFile(path.resolve('public/demonstracao.html')); });
app.use((_req, res) => { res.status(404).json({ erro: 'Rota não encontrada' }); });
app.use(errorMiddleware);
