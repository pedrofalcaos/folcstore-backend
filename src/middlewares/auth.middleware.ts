import { RequestHandler } from 'express';
import { Perfil } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { usuarioRepository } from '../repositories/usuario.repository';
import { usuarioPublico } from '../services/auth.service';
import { AppError } from '../errors/AppError';

declare global {
  namespace Express {
    interface Request {
      usuario?: { id: string; nome: string; email: string; perfil: Perfil };
    }
  }
}

export const autenticar: RequestHandler = async (req, _res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new AppError(401, 'Informe um token Bearer');
  let id: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'], issuer: 'folcstore-backend', audience: 'folcstore',
    });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error();
    id = payload.sub;
  } catch {
    throw new AppError(401, 'Token inválido ou expirado');
  }
  const usuario = await usuarioRepository.buscarPorId(id);
  if (!usuario) throw new AppError(401, 'Usuário não encontrado');
  req.usuario = usuarioPublico(usuario);
  next();
};

export function permitirPerfis(...perfis: Perfil[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      throw new AppError(403, 'Seu perfil não tem acesso a esta operação');
    }
    next();
  };
}
