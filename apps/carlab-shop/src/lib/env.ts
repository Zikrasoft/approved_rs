import { shopOpenSchema } from '@podbor/catalog-contract/preview';
import { z } from 'zod';

import { VIN_DECODER_NAMES } from './vin/decoders';

const LOCAL_TYPESENSE_API_KEY = 'xyz';

export const SUPPLIER_ADAPTER_NAMES = ['demo'] as const;

const nameList = (value: string) =>
  value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

const optionalValue = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const optionalSecret = optionalValue;

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
    LEAD_ROUTE_URL: optionalValue.pipe(z.url().optional()),
    VIN_DECODERS: z
      .string()
      .default(VIN_DECODER_NAMES.join(','))
      .transform(nameList)
      .pipe(z.array(z.enum(VIN_DECODER_NAMES)).min(1)),
    SUPPLIER_ADAPTERS: z
      .string()
      .default('')
      .transform(nameList)
      .pipe(z.array(z.enum(SUPPLIER_ADAPTER_NAMES))),
    DEMO_SUPPLIER_OVERRIDES: optionalValue,
    FILE_URL: optionalValue.pipe(z.url().optional()),
    TELEGRAM_BOT_TOKEN: optionalSecret,
    TELEGRAM_GROUP_ID: optionalValue.pipe(
      z
        .string()
        .regex(/^-?\d+$/)
        .optional(),
    ),
    SHOP_OPEN: shopOpenSchema,
  })
  .refine(
    ({ NODE_ENV, SUPPLIER_ADAPTERS }) =>
      NODE_ENV !== 'production' || !SUPPLIER_ADAPTERS.includes('demo'),
    {
      path: ['SUPPLIER_ADAPTERS'],
      message: 'The demo supplier never runs in production',
    },
  )
  .refine(
    ({ NODE_ENV, TYPESENSE_API_KEY }) =>
      NODE_ENV !== 'production' || TYPESENSE_API_KEY,
    {
      path: ['TYPESENSE_API_KEY'],
      message: 'TYPESENSE_API_KEY is required in production',
    },
  )
  .refine(({ NODE_ENV, FILE_URL }) => NODE_ENV !== 'production' || FILE_URL, {
    path: ['FILE_URL'],
    message: 'FILE_URL is required in production',
  })
  .transform((env) => ({
    ...env,
    TYPESENSE_API_KEY: env.TYPESENSE_API_KEY ?? LOCAL_TYPESENSE_API_KEY,
    FILE_URL: env.FILE_URL ?? `http://localhost:${env.PORT}/static`,
    SHOP_OPEN: env.SHOP_OPEN ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, string | undefined>): Env =>
  envSchema.parse(raw);
