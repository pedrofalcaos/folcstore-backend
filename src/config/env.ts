import 'dotenv/config';
import { z } from 'zod';

export const env = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3003),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
}).parse(process.env);
