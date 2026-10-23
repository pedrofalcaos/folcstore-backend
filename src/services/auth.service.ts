import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Usuario } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { usuarioRepository } from '../repositories/usuario.repository';
import { registerSchema, loginSchema } from '../validators/auth.schema';

export function usuarioPublico(usuario: Usuario) {
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
}

function criarSessao(usuario: Usuario) {
  const token = jwt.sign({}, env.JWT_SECRET, {
    subject: usuario.id, expiresIn: '1h', algorithm: 'HS256',
    issuer: 'folcstore-backend', audience: 'folcstore',
  });
  return { token, usuario: usuarioPublico(usuario) };
}

export const authService = {
  async registrar(dados: z.infer<typeof registerSchema>) {
    if (await usuarioRepository.buscarPorEmail(dados.email)) {
      throw new AppError(409, 'E-mail já cadastrado');
    }
    const { senha, ...perfil } = dados;
    const senhaHash = await bcrypt.hash(senha, 12);
    return criarSessao(await usuarioRepository.criar({ ...perfil, senhaHash }));
  },

  async entrar(dados: z.infer<typeof loginSchema>) {
    const usuario = await usuarioRepository.buscarPorEmail(dados.email);
    if (!usuario || !(await bcrypt.compare(dados.senha, usuario.senhaHash))) {
      throw new AppError(401, 'E-mail ou senha incorretos');
    }
    return criarSessao(usuario);
  },
};
