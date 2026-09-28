import { parseEnv } from '../env';

const SECRET = 'x'.repeat(32);
const HOOK_URL = 'https://carlab.rs/api/shop-order';

const PRODUCTION = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://medusa:pass@postgres:5432/medusa',
  REDIS_URL: 'redis://redis:6379',
  JWT_SECRET: SECRET,
  COOKIE_SECRET: SECRET,
};

describe('parseEnv', () => {
  it('runs a development machine on defaults alone', () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.STORE_CORS).toBe('http://localhost:4321');
    expect(env.ADMIN_CORS).toBe('http://localhost:9009');
    expect(env.AUTH_CORS).toBe('http://localhost:9009');
    expect(env.ADMIN_URL).toBe('https://api.carlab.rs/app');
    expect(env.DATABASE_SSL).toBe(false);
    expect(env.REBUILD_ON_CATALOG_EVENTS).toBe(false);
    expect(env.REBUILD_DEBOUNCE_MS).toBe(120_000);
  });

  it('treats a blank line in .env as unset', () => {
    const env = parseEnv({ OPENAI_API_KEY: '', STORE_CORS: '  ' });

    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.STORE_CORS).toBe('http://localhost:4321');
  });

  it('accepts a complete production environment', () => {
    expect(parseEnv(PRODUCTION).DATABASE_URL).toBe(PRODUCTION.DATABASE_URL);
  });

  it.each(['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'COOKIE_SECRET'])(
    'refuses production without %s',
    (key) => {
      expect(() => parseEnv({ ...PRODUCTION, [key]: undefined })).toThrow(key);
    },
  );

  it('refuses a session secret an attacker could guess', () => {
    expect(() => parseEnv({ JWT_SECRET: 'short' })).toThrow('JWT_SECRET');
  });

  it('refuses an order hook secret under 32 characters, spaces not counted', () => {
    expect(() =>
      parseEnv({
        SHOP_ORDER_HOOK_URL: HOOK_URL,
        SHOP_ORDER_HOOK_SECRET: ` ${'x'.repeat(31)} `,
      }),
    ).toThrow('SHOP_ORDER_HOOK_SECRET');
  });

  it('refuses an order hook URL without its secret, and a secret without its URL', () => {
    expect(() => parseEnv({ SHOP_ORDER_HOOK_URL: HOOK_URL })).toThrow(
      'SHOP_ORDER_HOOK_SECRET',
    );
    expect(() => parseEnv({ SHOP_ORDER_HOOK_SECRET: SECRET })).toThrow(
      'SHOP_ORDER_HOOK_SECRET',
    );
  });

  it('accepts a configured order hook', () => {
    const env = parseEnv({
      SHOP_ORDER_HOOK_URL: HOOK_URL,
      SHOP_ORDER_HOOK_SECRET: SECRET,
    });

    expect(env.SHOP_ORDER_HOOK_URL).toBe(HOOK_URL);
    expect(env.SHOP_ORDER_HOOK_SECRET).toBe(SECRET);
  });

  it('refuses a Brevo key without a sender, and a sender that is not an address', () => {
    expect(() => parseEnv({ BREVO_API_KEY: 'xkeysib-1' })).toThrow(
      'BREVO_FROM_EMAIL',
    );
    expect(() =>
      parseEnv({ BREVO_API_KEY: 'xkeysib-1', BREVO_FROM_EMAIL: 'shop' }),
    ).toThrow('BREVO_FROM_EMAIL');
  });

  it('refuses an admin URL that is not https, since the order card links to it', () => {
    expect(() => parseEnv({ ADMIN_URL: 'http://api.carlab.rs/app' })).toThrow(
      'ADMIN_URL',
    );
  });

  it('reads the rebuild switch and its debounce', () => {
    const env = parseEnv({
      REBUILD_ON_CATALOG_EVENTS: 'true',
      REBUILD_DEBOUNCE_MS: '5000',
    });

    expect(env.REBUILD_ON_CATALOG_EVENTS).toBe(true);
    expect(env.REBUILD_DEBOUNCE_MS).toBe(5000);
    expect(() => parseEnv({ REBUILD_ON_CATALOG_EVENTS: 'yes' })).toThrow(
      'REBUILD_ON_CATALOG_EVENTS',
    );
  });

  it('turns database SSL on only when asked', () => {
    expect(parseEnv({ DATABASE_SSL: 'true' }).DATABASE_SSL).toBe(true);
  });

  it('keeps nothing it does not know', () => {
    expect(parseEnv({ PATH: '/usr/bin' })).not.toHaveProperty('PATH');
  });
});
