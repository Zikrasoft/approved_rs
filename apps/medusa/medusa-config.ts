import { defineConfig, loadEnv } from '@medusajs/framework/utils';

import { parseEnv } from './src/lib/env';
import { brevoOptions } from './src/modules/notification-brevo/config';

loadEnv(process.env.NODE_ENV || 'development', process.cwd());

const env = parseEnv(process.env);
const brevo = brevoOptions(env);

const redisModules = (redisUrl: string) => [
  {
    resolve: '@medusajs/medusa/cache-redis',
    options: { redisUrl },
  },
  {
    resolve: '@medusajs/medusa/event-bus-redis',
    options: {
      redisUrl,
      jobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
      },
    },
  },
  {
    resolve: '@medusajs/medusa/workflow-engine-redis',
    options: { redis: { redisUrl } },
  },
  {
    resolve: '@medusajs/medusa/locking',
    options: {
      providers: [
        {
          resolve: '@medusajs/medusa/locking-redis',
          id: 'locking-redis',
          is_default: true,
          options: { redisUrl },
        },
      ],
    },
  },
];

export default defineConfig({
  projectConfig: {
    ...(env.REDIS_URL ? { redisUrl: env.REDIS_URL } : {}),
    databaseDriverOptions: env.DATABASE_SSL
      ? { ssl: { rejectUnauthorized: false } }
      : { ssl: false },
    http: {
      storeCors: env.STORE_CORS,
      adminCors: env.ADMIN_CORS,
      authCors: env.AUTH_CORS,
    },
  },
  featureFlags: { translation: true },
  modules: [
    { resolve: '@medusajs/medusa/translation' },
    { resolve: './src/modules/vehicle' },
    {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/file-local',
            id: 'local',
            options: { backend_url: `${env.MEDUSA_BACKEND_URL}/static` },
          },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/fulfillment',
      options: {
        providers: [
          { resolve: '@medusajs/medusa/fulfillment-manual', id: 'manual' },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          brevo
            ? {
                resolve: './src/modules/notification-brevo',
                id: 'brevo',
                options: { ...brevo, channels: ['email'] },
              }
            : {
                resolve: '@medusajs/medusa/notification-local',
                id: 'local',
                options: { channels: ['email'] },
              },
        ],
      },
    },
    ...(env.REDIS_URL ? redisModules(env.REDIS_URL) : []),
  ],
});
