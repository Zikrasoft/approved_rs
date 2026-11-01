import { afterEach, describe, expect, it, vi } from 'vitest';
import { BCP47_BY_LOCALE } from '@/i18n/config';
import { content } from '@/i18n/content';
import { PARTS_INQUIRY_OPEN_ATTRIBUTE } from '@/scripts/partsList';
import type { Fit } from '@/utils/catalogueSnapshot';
import { formatMoney } from '@/utils/money';
import PartOffers from './PartOffers.astro';
import PartOrderPanel from './PartOrderPanel.astro';
import PartStickyCta from './PartStickyCta.astro';
import { offer, partPage, render, setShop } from './renderAstro';

const copy = content('ru').shopPart;
const money = (price: number) => formatMoney(price, 'RSD', BCP47_BY_LOCALE.ru);

const fit = (make: string, model: string) =>
  ({
    vehicle: {
      model: {
        slug: model.toLowerCase(),
        name: model,
        chassis: {
          code: 'F30',
          series: {
            name: '3 серия',
            translations: null,
            make: { name: make, slug: make.toLowerCase() },
          },
        },
      },
    },
  }) as unknown as Fit;

const oemNumber = {
  id: 'pi_bmw',
  type: 'oem' as const,
  value: '34 11 6 850 568',
  normalized_value: '34116850568',
  superseded: false,
  brand: { name: 'BMW', slug: 'bmw' },
  images: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('PartOrderPanel', () => {
  it('sums up the fits, links the rest and the original number, and never prices', async () => {
    const page = partPage({
      fits: [fit('BMW', '318d'), fit('BMW', '320d'), fit('BMW', '330i')],
      equivalents: [{ ...oemNumber, superseded: true }, oemNumber],
    });
    const panel = await render(PartOrderPanel, { props: { page, part: {} } });

    expect(panel.querySelector('h2')?.textContent?.trim()).toBe(
      copy.orderHeading,
    );
    expect(panel.querySelector('a[href="#fits"]')?.textContent).toBe(
      copy.fitsMore.replace('{count}', '1'),
    );
    expect(
      panel.querySelector('a[href="/ru/parts/p/bmw-34116850568/"]'),
    ).not.toBeNull();
    const cta = panel.querySelector(`a[${PARTS_INQUIRY_OPEN_ATTRIBUTE}]`);
    expect(cta?.textContent?.trim()).toBe(copy.priceOnRequestCta);
    expect(cta?.getAttribute('href')).toBe(
      `/ru/parts/?${new URLSearchParams({ part: 'Bosch 0 986 494 524' })}#inquiry`,
    );
    expect(panel.textContent).not.toContain(copy.priceOnRequestHeading);
  });

  it('lists no fits or original number for an original part with no fits', async () => {
    const page = partPage({ ...oemNumber, equivalents: [oemNumber] });
    const panel = await render(PartOrderPanel, { props: { page, part: {} } });

    expect(panel.querySelector('dl')).toBeNull();
  });

  it('names the fits without a more link when they all fit in the summary', async () => {
    const page = partPage({ fits: [fit('BMW', '320d')] });
    const panel = await render(PartOrderPanel, { props: { page, part: {} } });

    expect(panel.querySelector('dd')?.textContent).toContain('320d');
    expect(panel.querySelector('a[href="#fits"]')).toBeNull();
  });
});

describe('PartOffers', () => {
  it('hands a closed shop to the order panel with no price on request card', async () => {
    setShop(false);
    const root = await render(PartOffers, { props: { page: partPage() } });

    expect(root.querySelector('part-offers')?.hasAttribute('hidden')).toBe(
      true,
    );
    expect(
      root.querySelector('part-offers')?.hasAttribute('data-preview'),
    ).toBe(true);
    expect(root.textContent).toContain(copy.orderHeading);
    expect(root.textContent).not.toContain(copy.priceOnRequestHeading);
  });

  it('keeps the page heading on the order panel while the shop is closed', async () => {
    setShop(false);
    const root = await render(PartOffers, {
      props: { page: partPage() },
      slots: { heading: 'Своя шапка' },
    });

    expect(root.querySelectorAll('h2')[1]?.textContent?.trim()).toBe(
      'Своя шапка',
    );
  });

  it('shows the offers of a priced part once the shop is open', async () => {
    setShop(true);
    const root = await render(PartOffers, {
      props: { page: partPage({ offers: [offer(3900)] }) },
    });
    const offers = root.querySelector('part-offers');

    expect(offers?.hasAttribute('hidden')).toBe(false);
    expect(offers?.textContent).toContain(money(3900));
    expect(root.textContent).not.toContain(copy.orderHeading);
  });

  it('points an unpriced part to a priced equivalent once the shop is open', async () => {
    setShop(true);
    const alternative = partPage({
      slug: 'ate-13046',
      value: '13.0460',
      brand: { name: 'ATE', slug: 'ate' },
      offers: [offer(2500)],
    });
    const root = await render(PartOffers, {
      props: { page: partPage(), alternative },
    });
    const link = root.querySelector('a[href="/ru/parts/p/ate-13046/"]');

    expect(root.querySelector('part-offers')).toBeNull();
    expect(root.textContent).toContain(copy.priceOnRequestHeading);
    expect(link?.textContent).toContain(copy.pricedEquivalentLabel);
    expect(link?.textContent).toContain(money(2500));
  });

  it('asks for a price with no equivalent to point to', async () => {
    setShop(true);
    const root = await render(PartOffers, { props: { page: partPage() } });

    expect(root.textContent).toContain(copy.priceOnRequestHeading);
    expect(root.textContent).not.toContain(copy.pricedEquivalentLabel);
  });
});

describe('PartStickyCta', () => {
  const sticky = (page = partPage()) =>
    render(PartStickyCta, { props: { page, target: 'offers' } });

  it('names the part instead of a price while the shop is closed', async () => {
    setShop(false);
    const bar = await sticky(partPage({ offers: [offer(3900)] }));

    expect(bar.textContent).toContain('Тормозные колодки');
    expect(bar.textContent).not.toContain(copy.priceOnRequestHeading);
    expect(bar.textContent).not.toContain('RSD');
    expect(bar.querySelector('part-cta-forward')?.getAttribute('data-to')).toBe(
      '#offers parts-list-add a',
    );
  });

  it('says the price is on request for an unpriced part once the shop is open', async () => {
    setShop(true);
    const bar = await sticky();

    expect(bar.textContent).toContain(copy.priceOnRequestHeading);
    expect(bar.querySelector('a')?.textContent?.trim()).toBe(
      copy.priceOnRequestCta,
    );
  });

  it('prices a priced part and forwards to its buy button once the shop is open', async () => {
    setShop(true);
    const priced = offer(3900);
    const bar = await sticky(partPage({ offers: [priced] }));

    expect(bar.textContent).toContain(money(3900));
    expect(bar.querySelector('part-cta-forward')?.getAttribute('data-to')).toBe(
      `#offers [data-buy][data-offer-id="${priced.id}"]`,
    );
    expect(bar.querySelector('a')?.textContent?.trim()).toBe(
      copy.buyButtonLabel,
    );
  });
});
