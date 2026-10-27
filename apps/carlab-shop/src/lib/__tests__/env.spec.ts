import { parseEnv } from '../env';

const VALID_ENV = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:55432/medusa',
  JWT_SECRET: 'test-jwt-secret',
  COOKIE_SECRET: 'test-cookie-secret',
  STORE_CORS: 'http://localhost:4321',
  ADMIN_CORS: 'http://localhost:9009',
  AUTH_CORS: 'http://localhost:9009',
};

const S3_ENV = {
  S3_REGION: 'eu-central-1',
  S3_ACCESS_KEY_ID: 'key-id',
  S3_SECRET_ACCESS_KEY: 'secret-key',
  S3_PUBLIC_BUCKET: 'carlab-public',
  S3_PRIVATE_BUCKET: 'carlab-private',
};

const PRODUCTION_ENV = {
  ...VALID_ENV,
  ...S3_ENV,
  NODE_ENV: 'production',
  TYPESENSE_API_KEY: 'secret',
  FILE_URL: 'https://carlab-public.s3.eu-central-1.amazonaws.com',
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

  it('reads an empty publish secret as unset', () => {
    const env = parseEnv({
      ...VALID_ENV,
      OPENAI_API_KEY: '',
      PUBLISH_DISPATCH_TOKEN: 'token',
    });

    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.PUBLISH_DISPATCH_TOKEN).toBe('token');
  });

  it('reads the order alert chat as a Telegram chat id, empty as unset', () => {
    expect(
      parseEnv({ ...VALID_ENV, TELEGRAM_GROUP_ID: '-100123' })
        .TELEGRAM_GROUP_ID,
    ).toBe('-100123');
    expect(
      parseEnv({ ...VALID_ENV, TELEGRAM_GROUP_ID: '' }).TELEGRAM_GROUP_ID,
    ).toBeUndefined();
    expect(() =>
      parseEnv({ ...VALID_ENV, TELEGRAM_GROUP_ID: 'crm-group' }),
    ).toThrow();
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

  it('falls back to the local Typesense key outside production', () => {
    expect(parseEnv(VALID_ENV).TYPESENSE_API_KEY).toBe('xyz');
  });

  it('requires the Typesense key in production', () => {
    expect(() => parseEnv({ ...VALID_ENV, NODE_ENV: 'production' })).toThrow(
      /TYPESENSE_API_KEY/,
    );
    expect(parseEnv(PRODUCTION_ENV).TYPESENSE_API_KEY).toBe('secret');
  });

  it('serves uploaded files from the local backend outside production', () => {
    expect(parseEnv(VALID_ENV).FILE_URL).toBe('http://localhost:9009/static');
    expect(parseEnv({ ...VALID_ENV, PORT: '4000' }).FILE_URL).toBe(
      'http://localhost:4000/static',
    );
  });

  it('requires the public file URL in production', () => {
    expect(() => parseEnv({ ...PRODUCTION_ENV, FILE_URL: undefined })).toThrow(
      /FILE_URL/,
    );
    expect(() => parseEnv({ ...VALID_ENV, FILE_URL: 'static' })).toThrow();
  });

  it('keeps files local outside production while no bucket is named', () => {
    expect(parseEnv(VALID_ENV).S3).toBeNull();
  });

  it('reads the S3 storage, with the endpoint optional for AWS itself', () => {
    expect(parseEnv({ ...VALID_ENV, ...S3_ENV }).S3).toEqual({
      endpoint: undefined,
      region: 'eu-central-1',
      accessKeyId: 'key-id',
      secretAccessKey: 'secret-key',
      publicBucket: 'carlab-public',
      privateBucket: 'carlab-private',
    });
    expect(
      parseEnv({
        ...VALID_ENV,
        ...S3_ENV,
        S3_ENDPOINT: 'http://127.0.0.1:59000',
      }).S3?.endpoint,
    ).toBe('http://127.0.0.1:59000');
  });

  it('refuses a half-configured S3 storage', () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, ...S3_ENV, S3_SECRET_ACCESS_KEY: '' }),
    ).toThrow(/S3_SECRET_ACCESS_KEY/);
    expect(() =>
      parseEnv({ ...VALID_ENV, ...S3_ENV, S3_ENDPOINT: 'minio' }),
    ).toThrow(/S3_ENDPOINT/);
  });

  it('requires the S3 storage in production', () => {
    expect(parseEnv(PRODUCTION_ENV).S3?.publicBucket).toBe('carlab-public');
    expect(() => parseEnv({ ...PRODUCTION_ENV, S3_PUBLIC_BUCKET: '' })).toThrow(
      /S3_PUBLIC_BUCKET/,
    );
  });

  it('never echoes an S3 secret in a validation error', () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, ...S3_ENV, S3_PUBLIC_BUCKET: '' }),
    ).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('secret-key'),
      }),
    );
  });

  it('chains the BMW and Mercedes decoders by default', () => {
    expect(parseEnv(VALID_ENV).VIN_DECODERS).toEqual([
      'bmw-type-code',
      'mercedes-baumuster',
    ]);
  });

  it('reads the decoder chain order from VIN_DECODERS', () => {
    expect(
      parseEnv({
        ...VALID_ENV,
        VIN_DECODERS: ' mercedes-baumuster , bmw-type-code ',
      }).VIN_DECODERS,
    ).toEqual(['mercedes-baumuster', 'bmw-type-code']);
  });

  it('refuses an unknown or empty decoder chain', () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, VIN_DECODERS: 'bmw-type-code,vindecoderz' }),
    ).toThrow();
    expect(() => parseEnv({ ...VALID_ENV, VIN_DECODERS: ' , ' })).toThrow();
  });

  it('runs no supplier adapter unless SUPPLIER_ADAPTERS names one', () => {
    expect(parseEnv(VALID_ENV).SUPPLIER_ADAPTERS).toEqual([]);
    expect(
      parseEnv({ ...VALID_ENV, SUPPLIER_ADAPTERS: ' demo ' }).SUPPLIER_ADAPTERS,
    ).toEqual(['demo']);
  });

  it('refuses an unknown supplier adapter', () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, SUPPLIER_ADAPTERS: 'demo,intercars' }),
    ).toThrow();
  });

  it('refuses the demo supplier in production', () => {
    expect(() =>
      parseEnv({
        ...VALID_ENV,
        NODE_ENV: 'production',
        TYPESENSE_API_KEY: 'key',
        SUPPLIER_ADAPTERS: 'demo',
      }),
    ).toThrow('The demo supplier never runs in production');
  });

  it('keeps the shop closed in production and open elsewhere unless SHOP_OPEN says', () => {
    const production = PRODUCTION_ENV;

    expect(parseEnv(production).SHOP_OPEN).toBe(false);
    expect(parseEnv({ ...production, SHOP_OPEN: 'true' }).SHOP_OPEN).toBe(true);
    expect(parseEnv(VALID_ENV).SHOP_OPEN).toBe(true);
    expect(parseEnv({ ...VALID_ENV, SHOP_OPEN: 'false' }).SHOP_OPEN).toBe(
      false,
    );
    expect(() => parseEnv({ ...VALID_ENV, SHOP_OPEN: 'yes' })).toThrow(
      /SHOP_OPEN/,
    );
  });
});
