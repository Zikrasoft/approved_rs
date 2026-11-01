import { partPageSlug } from '@podbor/catalog-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { offer, partPage, render, setShop } from '@/components/renderAstro';
import type { PartPageEntry } from '@/utils/catalogueSnapshot';
import { currentNumbers, partSuccessor } from '@/utils/partSuccessor';
import PartPage from './[slug].astro';

const copy = content('ru').shopPart;
const pickup = content('ru').shopCart.pickupMethod;

const successor = partPage({
  id: 'pi_new',
  slug: partPageSlug('bosch', 'NEW1'),
  value: 'NEW 1',
  normalized_value: 'NEW1',
});

const replaced = (over: Partial<PartPageEntry> = {}) =>
  partPage({
    part: {
      ...partPage().part,
      replaced_by: {
        id: 'part_new',
        name: 'Новые колодки',
        translations: null,
        brand_number: {
          id: successor.id,
          type: successor.type,
          value: successor.value,
          normalized_value: successor.normalized_value,
          superseded: false,
          brand: successor.brand,
        },
      },
    },
    ...over,
  });

const places = {
  makes: new Set<string>(),
  models: new Set<string>(),
  categories: new Set<string>(),
  vehicles: new Set<string>(),
};

const partPageHtml = async (pages: PartPageEntry[]) => {
  const [page] = pages;
  const bySlug = new Map(pages.map((entry) => [entry.slug, entry]));
  return render(PartPage, {
    path: `/ru/parts/p/${page.slug}/`,
    params: { locale: 'ru', slug: page.slug },
    props: {
      page,
      successor: partSuccessor(page, bySlug),
      replacements: currentNumbers(page, bySlug),
      bySlug,
      places,
    },
  });
};

const description = (root: Element) =>
  root.querySelector('meta[name="description"]')?.getAttribute('content');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the part page', () => {
  it('describes the part without prices, orders it and names the pickup while the shop is closed', async () => {
    setShop(false);
    const root = await partPageHtml([partPage()]);

    expect(description(root)).toBe(copy.metaDescriptionClosed);
    expect(root.textContent).toContain(copy.orderHeading);
    expect(root.textContent).toContain(pickup);
    expect(root.textContent).not.toContain(copy.priceOnRequestHeading);
    expect(root.textContent).not.toContain(copy.priceOnRequestTag);
  });

  it('describes prices and sells the part instead of ordering it once the shop is open', async () => {
    setShop(true);
    const root = await partPageHtml([partPage({ offers: [offer(3900)] })]);

    expect(description(root)).toBe(copy.metaDescription);
    expect(root.textContent).not.toContain(copy.orderHeading);
  });

  it('orders only the successor of a replaced part while the shop is closed', async () => {
    setShop(false);
    const root = await partPageHtml([replaced(), successor]);

    expect(root.textContent).toContain(copy.successorOrderHeading);
    expect(root.querySelectorAll('parts-list-add[data-slug]')).toHaveLength(1);
    expect(
      root
        .querySelector('parts-list-add[data-slug]')
        ?.getAttribute('data-slug'),
    ).toBe(successor.slug);
  });

  it('sells the priced successor of an unpriced replaced part once the shop is open', async () => {
    setShop(true);
    const root = await partPageHtml([
      replaced({ priceOnRequest: true }),
      { ...successor, offers: [offer(4100)] },
    ]);

    expect(root.textContent).toContain(copy.successorOffersHeading);
    expect(root.querySelectorAll('part-offers[data-slug]')).toHaveLength(1);
  });

  it('keeps the replaced part on offer beside an unpriced successor once the shop is open', async () => {
    setShop(true);
    const root = await partPageHtml([
      replaced({ offers: [offer(3900)] }),
      successor,
    ]);
    const offered = [...root.querySelectorAll('[data-slug]')].map((node) =>
      node.getAttribute('data-slug'),
    );

    expect(offered).toContain('bosch-0986494524');
    expect(offered).toContain(successor.slug);
  });
});
