import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const usuarioRepository = {
  buscarPorEmail: (email: string) => prisma.usuario.findUnique({ where: { email }, include: { enderecos: true } }),
  buscarPorId: (id: string) => prisma.usuario.findUnique({ where: { id }, include: { enderecos: true } }),
  criar: (data: Prisma.UsuarioCreateInput) => prisma.usuario.create({ data, include: { enderecos: true } }),
};
