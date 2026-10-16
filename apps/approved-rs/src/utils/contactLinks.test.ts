import { describe, it, expect } from 'vitest';
import { BRAND, TG_MANAGER } from './constants';
import { contactControl } from './contactLinks';

const telegram = { channel: 'telegram' } as const;

describe('contactControl', () => {
  it('opens the capture bot with the service and the locale', () => {
    expect(
      contactControl({
        ...telegram,
        onThanks: false,
        locale: 'ru',
        service: 'vehicle-sourcing',
      }).href,
    ).toBe(`https://t.me/${BRAND.captureBot}?start=vehicle-sourcing_ru`);
  });

  it('opens the manager account on the thanks page', () => {
    expect(
      contactControl({ ...telegram, onThanks: true, locale: 'ru' }).href,
    ).toBe(`https://t.me/${TG_MANAGER}`);
  });

  it('opens the manager account from the manager control on any page', () => {
    expect(
      contactControl({
        ...telegram,
        manager: true,
        onThanks: false,
        locale: 'ru',
      }).href,
    ).toBe(`https://t.me/${TG_MANAGER}`);
  });

  it('prefills WhatsApp in the visitor locale', () => {
    const whatsapp = (locale: string) =>
      contactControl({
        channel: 'whatsapp',
        onThanks: false,
        locale,
      }).href;
    expect(whatsapp('ru')).toContain('wa.me/');
    expect(whatsapp('ru')).toContain('?text=');
    expect(whatsapp('sr')).not.toBe(whatsapp('ru'));
    expect(decodeURIComponent(whatsapp('sr'))).toContain('Zdravo');
  });
});
