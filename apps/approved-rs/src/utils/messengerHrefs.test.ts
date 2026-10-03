import { describe, it, expect } from 'vitest';
import { messengerHrefs } from './messengerHrefs';
import { BRAND } from './constants';

describe('messengerHrefs', () => {
  it('opens the capture bot with the locale alone when the page has no service', () => {
    expect(messengerHrefs('sr').telegram).toBe(
      `https://t.me/${BRAND.captureBot}?start=sr`,
    );
  });

  it('carries the service and the locale when the page has one', () => {
    expect(messengerHrefs('ru', 'vehicle-sourcing').telegram).toBe(
      `https://t.me/${BRAND.captureBot}?start=vehicle-sourcing_ru`,
    );
  });

  it('keeps the WhatsApp prefill in the visitor locale', () => {
    const ru = messengerHrefs('ru');
    const sr = messengerHrefs('sr');
    expect(ru.whatsapp).toContain('wa.me/');
    expect(ru.whatsapp).toContain('?text=');
    expect(sr.whatsapp).not.toBe(ru.whatsapp);
    expect(decodeURIComponent(sr.whatsapp)).toContain('Zdravo');
  });
});
