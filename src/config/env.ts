import 'dotenv/config';
import { z } from 'zod';

export const env = z.object({
  RECOMMENDER_URL: z.string().url().default('http://127.0.0.1:3004'),
  RECOMMENDER_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(15000),
  PORT: z.coerce.number().int().min(1).max(65535).default(3003),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
}).parse(process.env);
