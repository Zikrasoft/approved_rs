import { shopOpenSchema } from '@podbor/catalog-contract/preview';
import { z } from 'zod';

import { VIN_DECODER_NAMES } from './vin/decoders';

const LOCAL_TYPESENSE_API_KEY = 'xyz';

export const SUPPLIER_ADAPTER_NAMES = [
  'demo',
  'mann-filter',
  'varta',
  'bilstein',
  'filtron',
] as const;

export type SupplierAdapterName = (typeof SUPPLIER_ADAPTER_NAMES)[number];

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

const S3_NAMES = [
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_PUBLIC_BUCKET',
  'S3_PRIVATE_BUCKET',
] as const;

type S3Name = (typeof S3_NAMES)[number];

const hasS3 = <Env extends Partial<Record<S3Name, string>>>(
  env: Env,
): env is Env & Record<S3Name, string> => S3_NAMES.every((name) => env[name]);

export type S3Config = {
  endpoint: string | undefined;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string;
  privateBucket: string;
};

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
    CRAWLER_FROM: optionalValue.pipe(z.email().optional()),
    FILE_URL: optionalValue.pipe(z.url().optional()),
    S3_ENDPOINT: optionalValue.pipe(z.url().optional()),
    S3_REGION: optionalValue,
    S3_ACCESS_KEY_ID: optionalSecret,
    S3_SECRET_ACCESS_KEY: optionalSecret,
    S3_PUBLIC_BUCKET: optionalValue,
    S3_PRIVATE_BUCKET: optionalValue,
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
  .superRefine((env, context) => {
    const missing = S3_NAMES.filter((name) => !env[name]);
    const required =
      env.NODE_ENV === 'production' || missing.length < S3_NAMES.length;
    if (!required) return;
    for (const name of missing) {
      context.addIssue({
        code: 'custom',
        path: [name],
        message: `${name} is required once any S3 setting is set, and always in production`,
      });
    }
  })
  .transform((env) => ({
    ...env,
    S3: hasS3(env)
      ? ({
          endpoint: env.S3_ENDPOINT,
          region: env.S3_REGION,
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          publicBucket: env.S3_PUBLIC_BUCKET,
          privateBucket: env.S3_PRIVATE_BUCKET,
        } satisfies S3Config)
      : null,
    TYPESENSE_API_KEY: env.TYPESENSE_API_KEY ?? LOCAL_TYPESENSE_API_KEY,
    FILE_URL: env.FILE_URL ?? `http://localhost:${env.PORT}/static`,
    SHOP_OPEN: env.SHOP_OPEN ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, string | undefined>): Env =>
  envSchema.parse(raw);
