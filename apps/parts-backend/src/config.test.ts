import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('reads DATABASE_URL, MEILI_URL and PORT from the given env', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://localhost/test',
      MEILI_URL: 'http://localhost:7700',
      PORT: '4100',
    });

    expect(config).toEqual({
      databaseUrl: 'postgres://localhost/test',
      meiliUrl: 'http://localhost:7700',
      port: 4100,
    });
  });

  it('defaults PORT to 4000 when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://localhost/test',
      MEILI_URL: 'http://localhost:7700',
    });

    expect(config.port).toBe(4000);
  });

  it('throws when a required var is missing', () => {
    expect(() => loadConfig({ MEILI_URL: 'http://localhost:7700' })).toThrow();
  });
});
