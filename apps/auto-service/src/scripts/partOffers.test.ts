// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTACT_CTA_SELECTOR } from '@podbor/site-kit/contact-control';
import { definePartOffers } from './partOffers';

definePartOffers();

const leadTime = {
  inStock: 'В наличии',
  inStockTomorrow: 'В наличии, завтра',
  inStockDays: { other: 'В наличии, через {days}' },
  tomorrow: 'Завтра',
  days: { other: 'Через {days}' },
};

const row = (cta: boolean) => `
  <li>
    <span data-price></span><span data-stock></span><span data-out></span><span data-lead></span>
    <div ${cta ? 'data-contact-cta' : ''}>
      <button data-buy class="btn-primary"><span data-label></span></button>
      <a data-ask></a>
    </div>
  </li>`;

const offer = (id: string, price: number, stock_quantity: number) => ({
  id,
  price,
  currency: 'RSD',
  stock_quantity,
  lead_time_days: stock_quantity ? 0 : 3,
});

afterEach(() => vi.unstubAllGlobals());

describe('<part-offers> live refresh', () => {
  it('fills the best row in place, so the in-flow contact marker the sticky bar watches survives', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          kind: 'offers',
          offers: [offer('later', 900, 0), offer('now', 1500, 2)],
        }),
      ),
    );
    document.body.innerHTML = `
      <part-offers data-id="pi_1" data-locale-tag="ru-RU" data-availability='${JSON.stringify(leadTime)}'>
        <ul data-offers>${row(true)}</ul>
        <details data-more><span data-more-count></span><ul data-more-offers></ul></details>
        <template data-offer>${row(false)}</template>
      </part-offers>`;
    const watched = document.querySelector(CONTACT_CTA_SELECTOR)!;

    await vi.waitFor(() =>
      expect(
        document
          .querySelector('[data-offers] [data-buy]')
          ?.getAttribute('data-offer-id'),
      ).toBe('now'),
    );

    expect(document.querySelector(CONTACT_CTA_SELECTOR)).toBe(watched);
    expect(document.querySelectorAll(CONTACT_CTA_SELECTOR)).toHaveLength(1);
    expect(
      document
        .querySelector('[data-more-offers] [data-buy]')
        ?.getAttribute('data-offer-id'),
    ).toBe('later');
  });
});
