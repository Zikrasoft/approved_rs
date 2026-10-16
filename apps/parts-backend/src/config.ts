import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  MEILI_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
});

export type Config = {
  databaseUrl: string;
  meiliUrl: string;
  port: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.parse(env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    meiliUrl: parsed.MEILI_URL,
    port: parsed.PORT,
  };
}
