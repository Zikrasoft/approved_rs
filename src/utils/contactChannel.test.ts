import { describe, it, expect } from 'vitest';
import { isTrackedContactChannel, TRACKED_CONTACT_CHANNELS, getPreferredChannel } from './contactChannel';

describe('isTrackedContactChannel', () => {
  it('is true for every tracked channel', () => {
    for (const channel of TRACKED_CONTACT_CHANNELS) {
      expect(isTrackedContactChannel(channel)).toBe(true);
    }
  });

  it('is false for callback — same attribute, but opens the lead modal instead of tracking', () => {
    expect(isTrackedContactChannel('callback')).toBe(false);
  });

  it('is false for null/undefined/empty string', () => {
    expect(isTrackedContactChannel(null)).toBe(false);
    expect(isTrackedContactChannel(undefined)).toBe(false);
    expect(isTrackedContactChannel('')).toBe(false);
  });

  it('is false for Object.prototype member names — the whole reason this is a guard and not a raw object-key lookup', () => {
    expect(isTrackedContactChannel('constructor')).toBe(false);
    expect(isTrackedContactChannel('toString')).toBe(false);
    expect(isTrackedContactChannel('hasOwnProperty')).toBe(false);
  });
});

describe('getPreferredChannel', () => {
  it('prefers WhatsApp for the Balkans and Western/Southern Europe', () => {
    expect(getPreferredChannel('rs')).toBe('whatsapp');
    expect(getPreferredChannel('de')).toBe('whatsapp');
    expect(getPreferredChannel('es')).toBe('whatsapp');
  });

  it('prefers Telegram for Russia/CIS', () => {
    expect(getPreferredChannel('ru')).toBe('telegram');
    expect(getPreferredChannel('ua')).toBe('telegram');
    expect(getPreferredChannel('kz')).toBe('telegram');
  });

  it('is case-insensitive', () => {
    expect(getPreferredChannel('RS')).toBe('whatsapp');
  });

  it('defaults to Telegram for an unlisted or missing country', () => {
    expect(getPreferredChannel('fr')).toBe('telegram');
    expect(getPreferredChannel(undefined)).toBe('telegram');
  });

  it('is false for Object.prototype member names used as a country code — no accidental lookup hit', () => {
    expect(getPreferredChannel('constructor')).toBe('telegram');
    expect(getPreferredChannel('toString')).toBe('telegram');
  });
});
