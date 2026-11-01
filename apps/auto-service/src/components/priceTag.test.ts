import { afterEach, describe, expect, it, vi } from 'vitest';
import { BCP47_BY_LOCALE } from '@/i18n/config';
import { content } from '@/i18n/content';
import { formatMoney } from '@/utils/money';
import PriceTag from './PriceTag.astro';
import { offer, render, setShop } from './renderAstro';

const copy = content('ru').shopPart;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('PriceTag', () => {
  it('renders nothing for an unpriced part while the shop is closed', async () => {
    setShop(false);
    const tag = await render(PriceTag, { props: { pages: [{ offers: [] }] } });

    expect(tag.textContent?.trim()).toBe('');
  });

  it('says the price is on request for an unpriced part once the shop is open', async () => {
    setShop(true);
    const tag = await render(PriceTag, {
      props: { pages: [{ offers: [] }], class: 'extra' },
    });

    expect(tag.textContent?.trim()).toBe(copy.priceOnRequestTag);
    expect(tag.querySelector('.extra')).not.toBeNull();
  });

  it('shows the lowest price with its stock', async () => {
    setShop(true);
    const tag = await render(PriceTag, {
      props: { pages: [{ offers: [offer(4200), offer(1850)] }] },
    });

    expect(tag.textContent).toContain(
      formatMoney(1850, 'RSD', BCP47_BY_LOCALE.ru),
    );
    expect(tag.textContent).not.toContain(
      formatMoney(4200, 'RSD', BCP47_BY_LOCALE.ru),
    );
    expect(tag.textContent).not.toContain(copy.priceOnRequestTag);
  });

  it('tells an unstocked offer with no lead time as out of stock', async () => {
    setShop(true);
    const tag = await render(PriceTag, {
      props: { pages: [{ offers: [offer(1850, 0, 0)] }] },
    });

    expect(tag.textContent).toContain(copy.outOfStock);
  });

  it('marks the offer a kit picks for the kit add', async () => {
    setShop(true);
    const kitOffer = offer(1850);
    const tag = await render(PriceTag, {
      props: { pages: [{ id: 'pi_1', offers: [kitOffer] }], kit: true },
    });
    const marked = tag.querySelector('[data-kit-offer]');

    expect(marked?.getAttribute('data-kit-offer')).toBe(kitOffer.id);
    expect(marked?.getAttribute('data-kit-price')).toBe('1850');
    expect(marked?.getAttribute('data-kit-currency')).toBe('RSD');
  });
});
