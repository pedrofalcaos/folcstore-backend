import { RequestHandler } from 'express';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema } from '../validators/auth.schema';

export const registrar: RequestHandler = async (req, res) => {
  res.status(201).json(await authService.registrar(registerSchema.parse(req.body)));
};

export const entrar: RequestHandler = async (req, res) => {
  res.json(await authService.entrar(loginSchema.parse(req.body)));
};

export const perfil: RequestHandler = (req, res) => {
  res.json(req.usuario);
};
