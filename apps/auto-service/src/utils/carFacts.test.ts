import { describe, expect, it } from 'vitest';
import { vinFrom } from './carFacts';

describe('the VIN on a page address', () => {
  it('reads the VIN that found the car so the inquiry can name it', () => {
    expect(vinFrom('?make=bmw&vin=WBA35BG070N074158')).toBe(
      'WBA35BG070N074158',
    );
  });

  it('reads no VIN from an address that carries none or a broken one', () => {
    expect(vinFrom('')).toBe('');
    expect(vinFrom('?vin=WBA35')).toBe('');
  });

  it('reads a VIN the address carries in lower case or Cyrillic look-alikes', () => {
    expect(vinFrom('?vin=w%D0%B2a35bg070n074158')).toBe('WBA35BG070N074158');
  });
});
