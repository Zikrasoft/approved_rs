import { describe, it, expect, vi } from 'vitest';
import { BRAND } from './constants';

const load = async (manager?: string) => {
  vi.resetModules();
  vi.stubEnv('PUBLIC_TG_MANAGER', manager);
  return (await import('./contactLinks')).contactControl;
};

const telegram = { channel: 'telegram', placement: 'bar' } as const;

describe('contactControl', () => {
  it('opens the capture bot with the service and the locale', async () => {
    const contactControl = await load('approved_manager');
    expect(
      contactControl({
        ...telegram,
        onThanks: false,
        locale: 'ru',
        service: 'vehicle-sourcing',
      }).href,
    ).toBe(`https://t.me/${BRAND.captureBot}?start=vehicle-sourcing_ru`);
  });

  it('opens the manager account on the thanks page', async () => {
    const contactControl = await load('approved_manager');
    expect(
      contactControl({ ...telegram, onThanks: true, locale: 'ru' }).href,
    ).toBe('https://t.me/approved_manager');
  });

  it('falls back to the capture bot on the thanks page when no manager handle is set', async () => {
    const contactControl = await load(undefined);
    expect(
      contactControl({ ...telegram, onThanks: true, locale: 'ru' }).href,
    ).toBe(`https://t.me/${BRAND.captureBot}?start=ru`);
  });

  it('prefills WhatsApp in the visitor locale', async () => {
    const contactControl = await load();
    const whatsapp = (locale: string) =>
      contactControl({
        channel: 'whatsapp',
        placement: 'bar',
        onThanks: false,
        locale,
      }).href;
    expect(whatsapp('ru')).toContain('wa.me/');
    expect(whatsapp('ru')).toContain('?text=');
    expect(whatsapp('sr')).not.toBe(whatsapp('ru'));
    expect(decodeURIComponent(whatsapp('sr'))).toContain('Zdravo');
  });
});
