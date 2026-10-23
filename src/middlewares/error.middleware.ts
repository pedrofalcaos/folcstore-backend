import { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ erro: 'Dados inválidos', detalhes: error.flatten() });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ erro: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res.status(409).json({ erro: 'Registro já cadastrado' });
    return;
  }
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ erro: 'JSON inválido' });
    return;
  }
  if (error.type === 'entity.too.large') {
    res.status(413).json({ erro: 'Corpo da requisição muito grande' });
    return;
  }
  console.error(error);
  res.status(500).json({ erro: 'Erro interno do servidor' });
};
