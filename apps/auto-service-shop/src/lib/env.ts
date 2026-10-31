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

const envFields = z.object({
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
  OPENAI_IMPORT_MODEL: optionalValue.transform(
    (model) => model ?? 'gpt-4o-mini',
  ),
  IMPORT_CONCURRENCY: optionalValue
    .transform((articles) => Number(articles ?? 4))
    .pipe(z.number().int().positive()),
  LIVE_QUOTE_CACHE_SECONDS: optionalValue
    .transform((seconds) => Number(seconds ?? 60))
    .pipe(z.number().int().nonnegative()),
  PUBLISH_DISPATCH_TOKEN: optionalSecret,
  LEAD_ROUTE_URL: optionalValue.pipe(z.url().optional()),
  SHOP_LEAD_SECRET: optionalSecret,
  SHOP_ORDER_OUTCOME_SECRET: optionalSecret,
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
});

type S3Fields = { NODE_ENV: string } & Partial<
  Record<S3Name | 'S3_ENDPOINT', string>
>;

const requireS3 = (env: S3Fields, context: z.RefinementCtx) => {
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
};

const s3ConfigOf = (env: S3Fields): S3Config | null =>
  hasS3(env)
    ? {
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        publicBucket: env.S3_PUBLIC_BUCKET,
        privateBucket: env.S3_PRIVATE_BUCKET,
      }
    : null;

const envSchema = envFields
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
  .superRefine(requireS3)
  .transform((env) => ({
    ...env,
    S3: s3ConfigOf(env),
    TYPESENSE_API_KEY: env.TYPESENSE_API_KEY ?? LOCAL_TYPESENSE_API_KEY,
    FILE_URL: env.FILE_URL ?? `http://localhost:${env.PORT}/static`,
    SHOP_OPEN: env.SHOP_OPEN ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (raw: Record<string, string | undefined>): Env =>
  envSchema.parse(raw);

const crawlerFields = envFields.pick({
  NODE_ENV: true,
  DATABASE_URL: true,
  DATABASE_SSL: true,
  CRAWLER_FROM: true,
  S3_ENDPOINT: true,
  S3_REGION: true,
  S3_ACCESS_KEY_ID: true,
  S3_SECRET_ACCESS_KEY: true,
  S3_PUBLIC_BUCKET: true,
  S3_PRIVATE_BUCKET: true,
});

export const CRAWLER_ENV_NAMES = Object.keys(crawlerFields.shape);

const crawlerEnvSchema = crawlerFields
  .superRefine(requireS3)
  .transform((env) => ({ ...env, S3: s3ConfigOf(env) }));

export type CrawlerEnv = z.infer<typeof crawlerEnvSchema>;

export const parseCrawlerEnv = (
  raw: Record<string, string | undefined>,
): CrawlerEnv => crawlerEnvSchema.parse(raw);
