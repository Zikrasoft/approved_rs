import { describe, it, expect } from 'vitest';
import {
  CONTACT_PLACEMENTS,
  contactPlacement,
  GOALS,
  type ContactPlacement,
} from './goals.ts';

describe('GOALS', () => {
  it('names the shop funnel', () => {
    expect(GOALS.addToCart).toBe('add_to_cart');
    expect(GOALS.beginCheckout).toBe('begin_checkout');
    expect(GOALS.orderPlaced).toBe('order_placed');
  });

  it('uses unique snake_case identifiers, the form Metrika goals are created with', () => {
    const ids = Object.values(GOALS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
  });
});

describe('CONTACT_PLACEMENTS', () => {
  it('names page regions the three counters share', () => {
    expect(CONTACT_PLACEMENTS).toEqual([
      'hero',
      'bar',
      'floating',
      'footer',
      'header',
      'thanks',
    ]);
  });

  it('uses unique single lowercase words', () => {
    expect(new Set(CONTACT_PLACEMENTS).size).toBe(CONTACT_PLACEMENTS.length);
    for (const placement of CONTACT_PLACEMENTS)
      expect(placement).toMatch(/^[a-z]+$/);
  });

  it('stamps the attribute the click tracker reads', () => {
    const placement: ContactPlacement = 'footer';
    expect(contactPlacement(placement)).toEqual({
      'data-contact-placement': 'footer',
    });
  });
});
