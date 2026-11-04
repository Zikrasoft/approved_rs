import { describe, expect, it } from 'vitest';

import {
  MAX_DEMAND_PARTS,
  requestIdSchema,
  storefrontEventSchema,
} from './events.ts';

describe('storefrontEventSchema', () => {
  it('reads a search event with its request id', () => {
    expect(
      storefrontEventSchema.parse({
        event: 'storefront.search',
        request_id: 'fra1::iad1::abc-1700000000000-def',
        route: 'suggest',
        intent: 'query',
        outcome: 'ok',
        results: 0,
        duration_ms: 42.5,
      }),
    ).toEqual({
      event: 'storefront.search',
      request_id: 'fra1::iad1::abc-1700000000000-def',
      route: 'suggest',
      intent: 'query',
      outcome: 'ok',
      results: 0,
      duration_ms: 42.5,
    });
  });

  it('strips a key the schema does not name, so nothing unvetted is logged', () => {
    expect(
      storefrontEventSchema.parse({
        event: 'storefront.lead',
        source: 'leads',
        service: null,
        outcome: 'stored',
        reason: null,
        phone: '+381601234567',
      }),
    ).toEqual({
      event: 'storefront.lead',
      request_id: null,
      source: 'leads',
      service: null,
      outcome: 'stored',
      reason: null,
    });
  });

  it('drops a malformed request id instead of refusing the event', () => {
    expect(
      storefrontEventSchema.parse({
        event: 'storefront.cart',
        request_id: 'x y',
        action: 'add',
        outcome: 'cart',
        reason: null,
      }).request_id,
    ).toBeNull();
  });

  it.each([
    { event: 'storefront.unknown' },
    {
      event: 'storefront.checkout',
      outcome: 'placed',
      reason: 'call me at +381 60 123',
    },
    {
      event: 'storefront.lead',
      source: 'leads',
      service: 'x381601234567',
      outcome: 'stored',
      reason: null,
    },
    {
      event: 'storefront.cart',
      action: 'add',
      outcome: '42',
      reason: null,
    },
    { event: 'storefront.csp', directive: 'script-src', blocked: 'a b' },
    {
      event: 'storefront.search',
      route: 'count',
      intent: 'vin',
      outcome: 'ok',
      results: -1,
      duration_ms: 1,
    },
    { event: 'storefront.demand', signal: 'inquiry', parts: [] },
    { event: 'storefront.demand', signal: 'view', parts: ['bosch-1'] },
    { event: 'storefront.demand', signal: 'pick', parts: ['Bosch 1'] },
    {
      event: 'storefront.demand',
      signal: 'inquiry',
      parts: Array.from(
        { length: MAX_DEMAND_PARTS + 1 },
        (_, index) => `bosch-${index}`,
      ),
    },
  ])('refuses %j', (event) => {
    expect(storefrontEventSchema.safeParse(event).success).toBe(false);
  });

  it('takes the part page slugs an inquiry or a pick named', () => {
    expect(
      storefrontEventSchema.parse({
        event: 'storefront.demand',
        signal: 'inquiry',
        parts: ['mann-filter-hu816x', 'bosch-0986494524'],
      }),
    ).toEqual({
      event: 'storefront.demand',
      request_id: null,
      signal: 'inquiry',
      parts: ['mann-filter-hu816x', 'bosch-0986494524'],
    });
  });

  it('takes a CSP report as a directive and a host', () => {
    expect(
      storefrontEventSchema.parse({
        event: 'storefront.csp',
        directive: 'script-src-elem',
        blocked: 'evil.example.com',
      }),
    ).toMatchObject({
      directive: 'script-src-elem',
      blocked: 'evil.example.com',
    });
  });
});

describe('requestIdSchema', () => {
  it('takes a Vercel id and refuses spaces and long strings', () => {
    expect(requestIdSchema.safeParse('fra1::xyz-1').success).toBe(true);
    expect(requestIdSchema.safeParse('a b').success).toBe(false);
    expect(requestIdSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
});
