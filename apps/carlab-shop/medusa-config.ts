import { defineConfig, loadEnv } from '@medusajs/framework/utils';

import { parseEnv } from './src/lib/env';

loadEnv(process.env.NODE_ENV || 'development', process.cwd());

const env = parseEnv(process.env);

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
  modules: [
    {
      resolve: './src/modules/part',
    },
    {
      resolve: './src/modules/vehicle',
    },
    {
      resolve: './src/modules/vin-lookup',
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
