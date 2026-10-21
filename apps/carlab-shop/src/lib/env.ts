import { z } from 'zod';

import { VIN_DECODER_NAMES } from './vin/decoders';

const LOCAL_TYPESENSE_API_KEY = 'xyz';

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z
  .object({
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
    TYPESENSE_API_KEY: optionalSecret,
    OPENAI_API_KEY: optionalSecret,
    PUBLISH_DISPATCH_TOKEN: optionalSecret,
    LEAD_ROUTE_URL: optionalSecret.pipe(z.url().optional()),
    VIN_DECODERS: z
      .string()
      .default(VIN_DECODER_NAMES.join(','))
      .transform((value) =>
        value
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.enum(VIN_DECODER_NAMES)).min(1)),
  })
  .refine(
    ({ NODE_ENV, TYPESENSE_API_KEY }) =>
      NODE_ENV !== 'production' || TYPESENSE_API_KEY,
    {
      path: ['TYPESENSE_API_KEY'],
      message: 'TYPESENSE_API_KEY is required in production',
    },
  )
  .transform((env) => ({
    ...env,
    TYPESENSE_API_KEY: env.TYPESENSE_API_KEY ?? LOCAL_TYPESENSE_API_KEY,
  }));

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, string | undefined>): Env =>
  envSchema.parse(raw);
