import { describe, expect, it } from 'vitest';
import { carFactsQuery, vinFactsFrom, vinFrom } from './carFacts';

describe('VIN facts on the car page address', () => {
  it('carries the steering a VIN revealed to the static car page', () => {
    const query = carFactsQuery({ steering: 'right' });

    expect(query).toBe('?steering=right');
    expect(vinFactsFrom(query)).toEqual({ steering: 'right' });
  });

  it('adds nothing when the VIN revealed nothing', () => {
    expect(carFactsQuery({})).toBe('');
  });

  it('ignores a steering value the VIN cannot reveal', () => {
    expect(vinFactsFrom('?steering=middle')).toEqual({});
    expect(vinFactsFrom('')).toEqual({});
  });

  it('carries the VIN that found the car so the inquiry can name it', () => {
    const query = carFactsQuery({ steering: 'left' }, 'WBA35BG070N074158');

    expect(vinFrom(query)).toBe('WBA35BG070N074158');
    expect(vinFactsFrom(query)).toEqual({ steering: 'left' });
  });

  it('reads no VIN from an address that carries none or a broken one', () => {
    expect(vinFrom('')).toBe('');
    expect(vinFrom('?vin=WBA35')).toBe('');
  });
});
