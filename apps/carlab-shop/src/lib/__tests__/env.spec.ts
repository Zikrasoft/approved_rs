import { parseEnv } from '../env';

const VALID_ENV = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:55432/medusa',
  JWT_SECRET: 'test-jwt-secret',
  COOKIE_SECRET: 'test-cookie-secret',
  STORE_CORS: 'http://localhost:4321',
  ADMIN_CORS: 'http://localhost:9009',
  AUTH_CORS: 'http://localhost:9009',
};

describe('parseEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = parseEnv(VALID_ENV);

    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(9009);
    expect(env.DATABASE_SSL).toBe(false);
    expect(env.TYPESENSE_HOST).toBe('127.0.0.1');
    expect(env.TYPESENSE_PORT).toBe(8108);
    expect(env.TYPESENSE_PROTOCOL).toBe('http');
  });

  it('coerces TYPESENSE_PORT from a string env value', () => {
    const env = parseEnv({ ...VALID_ENV, TYPESENSE_PORT: '58108' });

    expect(env.TYPESENSE_PORT).toBe(58108);
  });

  it('coerces PORT from a string env value', () => {
    const env = parseEnv({ ...VALID_ENV, PORT: '4000' });

    expect(env.PORT).toBe(4000);
  });

  it('parses DATABASE_SSL=false as false', () => {
    const env = parseEnv({ ...VALID_ENV, DATABASE_SSL: 'false' });

    expect(env.DATABASE_SSL).toBe(false);
  });

  it('parses DATABASE_SSL=true as true', () => {
    const env = parseEnv({ ...VALID_ENV, DATABASE_SSL: 'true' });

    expect(env.DATABASE_SSL).toBe(true);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({ ...VALID_ENV, DATABASE_URL: undefined })).toThrow();
  });

  it('throws when a required secret is missing', () => {
    expect(() => parseEnv({ ...VALID_ENV, JWT_SECRET: undefined })).toThrow();
  });
});
