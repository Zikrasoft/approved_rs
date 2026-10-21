import { describe, expect, it } from 'vitest';
import { carFactsQuery, vinFactsFrom } from './carFacts';

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
});
