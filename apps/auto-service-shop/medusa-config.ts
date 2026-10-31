import { defineConfig, loadEnv } from '@medusajs/framework/utils';

import { adminLanguage } from './src/lib/admin-language';
import { readCalendarDatesAsText } from './src/lib/calendar-dates';
import { parseEnv } from './src/lib/env';

loadEnv(process.env.NODE_ENV || 'development', process.cwd());

const env = parseEnv(process.env);

readCalendarDatesAsText();

const fileProvider = env.S3
  ? {
      resolve: '@medusajs/medusa/file-s3',
      id: 's3',
      options: {
        file_url: env.FILE_URL,
        access_key_id: env.S3.accessKeyId,
        secret_access_key: env.S3.secretAccessKey,
        region: env.S3.region,
        bucket: env.S3.publicBucket,
        endpoint: env.S3.endpoint,
        acl: false,
        additional_client_config: { forcePathStyle: Boolean(env.S3.endpoint) },
      },
    }
  : {
      resolve: '@medusajs/medusa/file-local',
      id: 'local',
      options: { backend_url: env.FILE_URL },
    };

export default defineConfig({
  projectConfig: {
    databaseUrl: env.DATABASE_URL,
    databaseDriverOptions: {
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
      pool: { min: 2, max: 10 },
    },
    http: {
      storeCors: env.STORE_CORS,
      adminCors: env.ADMIN_CORS,
      authCors: env.AUTH_CORS,
      jwtSecret: env.JWT_SECRET,
      cookieSecret: env.COOKIE_SECRET,
    },
  },
  admin: {
    vite: () => ({ plugins: [adminLanguage()] }),
  },
  // TODO: no Locking provider is set, so the cart and order-lead locks are in-memory and exclusive only inside one process; configure the Postgres or Redis Locking provider before splitting server and worker (MEDUSA_WORKER_MODE).
  modules: [
    {
      resolve: './src/modules/catalog',
    },
    {
      resolve: './src/modules/supplier',
    },
    {
      resolve: './src/modules/vin-lookup',
    },
    {
      resolve: './src/modules/publish',
    },
    {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [fileProvider],
      },
    },
    {
      resolve: '@medusajs/medusa/search',
      options: {
        default_provider: 'typesense',
        providers: [
          {
            resolve: './src/modules/search-typesense',
            id: 'typesense',
            options: {
              host: env.TYPESENSE_HOST,
              port: env.TYPESENSE_PORT,
              protocol: env.TYPESENSE_PROTOCOL,
              apiKey: env.TYPESENSE_API_KEY,
            },
          },
        ],
      },
    },
  ],
});
