import { describe, it, expect, vi } from 'vitest';
import { BRAND } from './constants';

const load = async (manager?: string) => {
  vi.resetModules();
  vi.stubEnv('PUBLIC_TG_MANAGER', manager);
  return (await import('./messengerHrefs')).messengerHrefs;
};

describe('messengerHrefs', () => {
  it('opens the capture bot with the locale alone when the page has no service', async () => {
    const messengerHrefs = await load('approved_manager');
    expect(messengerHrefs('sr').telegram).toBe(
      `https://t.me/${BRAND.captureBot}?start=sr`,
    );
  });

  it('carries the service and the locale when the page has one', async () => {
    const messengerHrefs = await load('approved_manager');
    expect(messengerHrefs('ru', 'vehicle-sourcing').telegram).toBe(
      `https://t.me/${BRAND.captureBot}?start=vehicle-sourcing_ru`,
    );
  });

  it('opens the manager account instead where the page asks for a human', async () => {
    const messengerHrefs = await load('approved_manager');
    expect(messengerHrefs('ru', undefined, { human: true }).telegram).toBe(
      'https://t.me/approved_manager',
    );
  });

  it('falls back to the capture bot for a human when no manager handle is set', async () => {
    const messengerHrefs = await load(undefined);
    expect(messengerHrefs('ru', undefined, { human: true }).telegram).toBe(
      `https://t.me/${BRAND.captureBot}?start=ru`,
    );
  });

  it('keeps the WhatsApp prefill in the visitor locale', async () => {
    const messengerHrefs = await load();
    const ru = messengerHrefs('ru');
    const sr = messengerHrefs('sr');
    expect(ru.whatsapp).toContain('wa.me/');
    expect(ru.whatsapp).toContain('?text=');
    expect(sr.whatsapp).not.toBe(ru.whatsapp);
    expect(decodeURIComponent(sr.whatsapp)).toContain('Zdravo');
  });
});
