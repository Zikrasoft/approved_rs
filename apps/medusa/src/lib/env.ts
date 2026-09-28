import { z } from 'zod';

const secret = z.string().min(32);

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'COOKIE_SECRET',
] as const;

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//)
      .optional(),
    DATABASE_SSL: flag,
    REDIS_URL: z
      .string()
      .regex(/^rediss?:\/\//)
      .optional(),
    JWT_SECRET: secret.optional(),
    COOKIE_SECRET: secret.optional(),
    STORE_CORS: z.string().default('http://localhost:4321'),
    ADMIN_CORS: z.string().default('http://localhost:9009'),
    AUTH_CORS: z.string().default('http://localhost:9009'),
    ADMIN_URL: z
      .url({ protocol: /^https$/ })
      .default('https://api.carlab.rs/app'),
    OPENAI_API_KEY: z.string().optional(),
    BREVO_API_KEY: z.string().optional(),
    BREVO_FROM_EMAIL: z.email().optional(),
    BREVO_FROM_NAME: z.string().max(70).optional(),
    GITHUB_DISPATCH_TOKEN: z.string().optional(),
    REBUILD_ON_CATALOG_EVENTS: flag,
    REBUILD_DEBOUNCE_MS: z.coerce.number().int().positive().default(120_000),
    SHOP_ORDER_HOOK_URL: z.url({ protocol: /^https?$/ }).optional(),
    SHOP_ORDER_HOOK_SECRET: z.string().trim().min(32).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      for (const key of REQUIRED_IN_PRODUCTION) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'required in production',
          });
        }
      }
    }
    if (!env.SHOP_ORDER_HOOK_URL !== !env.SHOP_ORDER_HOOK_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['SHOP_ORDER_HOOK_SECRET'],
        message: 'SHOP_ORDER_HOOK_URL and SHOP_ORDER_HOOK_SECRET go together',
      });
    }
    if (!env.BREVO_API_KEY !== !env.BREVO_FROM_EMAIL) {
      ctx.addIssue({
        code: 'custom',
        path: ['BREVO_FROM_EMAIL'],
        message: 'BREVO_API_KEY and BREVO_FROM_EMAIL go together',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const present = Object.fromEntries(
    Object.entries(source).filter(
      ([, value]) => value !== undefined && value.trim() !== '',
    ),
  );
  const result = envSchema.safeParse(present);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
