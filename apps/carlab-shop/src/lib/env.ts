import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(9009),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  JWT_SECRET: z.string().min(1),
  COOKIE_SECRET: z.string().min(1),
  STORE_CORS: z.string().min(1),
  ADMIN_CORS: z.string().min(1),
  AUTH_CORS: z.string().min(1),
  TYPESENSE_HOST: z.string().min(1).default('127.0.0.1'),
  TYPESENSE_PORT: z.coerce.number().int().positive().default(8108),
  TYPESENSE_PROTOCOL: z.enum(['http', 'https']).default('http'),
  TYPESENSE_API_KEY: z.string().min(1).default('xyz'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  PUBLISH_DISPATCH_TOKEN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, string | undefined>): Env =>
  envSchema.parse(raw);
