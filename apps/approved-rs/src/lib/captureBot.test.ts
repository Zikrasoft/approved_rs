import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return import('./captureBot');
};

afterEach(() => vi.unstubAllEnvs());

describe('captureClientFor', () => {
  it('relays only through approved.rs without the sibling tokens', async () => {
    const { captureClientFor, captureClient, REPLY_RELAY_BRANDS } = await load({
      TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB: '',
      TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS: '',
    });
    expect(REPLY_RELAY_BRANDS).toEqual(['Approved.rs']);
    expect(captureClientFor('Approved.rs')).toBe(captureClient);
    expect(captureClientFor('CarLab')).toBeUndefined();
    expect(captureClientFor('Details')).toBeUndefined();
  });

  it('adds a sibling brand once its capture token is set', async () => {
    const { captureClientFor, captureClient, REPLY_RELAY_BRANDS } = await load({
      TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB: 'carlab-token',
      TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS: 'details-token',
    });
    expect(REPLY_RELAY_BRANDS).toEqual(['Approved.rs', 'CarLab', 'Details']);
    expect(captureClientFor('CarLab')).toBeDefined();
    expect(captureClientFor('CarLab')).not.toBe(captureClient);
    expect(captureClientFor('Details')).toBeDefined();
    expect(captureClientFor('Unknown')).toBeUndefined();
  });
});
