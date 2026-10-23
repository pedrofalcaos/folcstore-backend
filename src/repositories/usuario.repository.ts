import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const usuarioRepository = {
  buscarPorEmail: (email: string) => prisma.usuario.findUnique({ where: { email } }),
  buscarPorId: (id: string) => prisma.usuario.findUnique({ where: { id } }),
  criar: (data: Prisma.UsuarioCreateInput) => prisma.usuario.create({ data }),
};
