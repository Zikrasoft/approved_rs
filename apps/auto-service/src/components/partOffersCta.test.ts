import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTACT_CTA_SELECTOR } from '@podbor/site-kit/contact-control';
import PartOffers from './PartOffers.astro';
import { offer, partPage, render, setShop } from './renderAstro';

afterEach(() => {
  vi.unstubAllEnvs();
});

const pricedOffers = async () => {
  setShop(true);
  const root = await render(PartOffers, {
    props: {
      page: partPage({
        offers: [offer(2400), offer(1850, 0, 7), offer(1500, 0, 14)],
      }),
    },
  });
  return root.querySelector('part-offers')!;
};

describe('the in-flow contact marker on a priced part', () => {
  it('stays off the offers card, so a sliver of the card cannot hide the sticky bar', async () => {
    const card = await pricedOffers();

    expect(card.matches(CONTACT_CTA_SELECTOR)).toBe(false);
  });

  it('sits on the best offer buttons only', async () => {
    const card = await pricedOffers();
    const marked = (selector: string) =>
      card.querySelectorAll(`${selector} ${CONTACT_CTA_SELECTOR}`);

    expect(marked('[data-offers]')).toHaveLength(1);
    expect(card.querySelector('[data-more-offers]')!.children).toHaveLength(2);
    expect(marked('[data-more-offers]')).toHaveLength(0);
    expect(
      card
        .querySelector<HTMLTemplateElement>('template[data-offer]')!
        .content.querySelector(CONTACT_CTA_SELECTOR),
    ).toBeNull();
  });
});
