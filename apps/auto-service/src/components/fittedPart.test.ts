import { afterEach, describe, expect, it, vi } from 'vitest';
import { BCP47_BY_LOCALE } from '@/i18n/config';
import { content } from '@/i18n/content';
import { formatMoney } from '@/utils/money';
import FittedPart from './FittedPart.astro';
import { offer, partPage, render, setShop } from './renderAstro';

const copy = content('ru').shopPart;

const unpriced = partPage();
const priced = partPage({
  id: 'pi_ate',
  slug: 'ate-13046',
  value: '13.0460-7184.2',
  brand: { name: 'ATE', slug: 'ate' },
  offers: [offer(3900)],
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const links = (row: Element) =>
  [...row.querySelectorAll('a')].map((link) => link.getAttribute('href'));

describe('FittedPart', () => {
  it('shows neither the quantity nor a price while the shop is closed', async () => {
    setShop(false);
    const row = await render(FittedPart, {
      props: {
        pages: [priced],
        name: 'Колодки',
        specs: 'Передняя ось',
        quantity: '4 шт.',
      },
    });

    expect(row.querySelector('p.spec')?.textContent).toBe('Передняя ось');
    expect(row.textContent).not.toContain('4 шт.');
    expect(row.textContent).not.toContain('RSD');
    expect(row.textContent).not.toContain(copy.priceOnRequestTag);
  });

  it('keeps the spec line empty without specs', async () => {
    setShop(false);
    const row = await render(FittedPart, {
      props: { pages: [unpriced], name: 'Колодки' },
    });

    expect(row.querySelector('p.spec')).toBeNull();
  });

  it('prices the row and shows the quantity beside the price once the shop is open', async () => {
    setShop(true);
    const row = await render(FittedPart, {
      props: {
        pages: [priced],
        name: 'Колодки',
        specs: 'Передняя ось',
        quantity: '4 шт.',
      },
    });

    expect(row.querySelector('p.spec')?.textContent).toBe('Передняя ось');
    expect(row.textContent).toContain(
      formatMoney(3900, 'RSD', BCP47_BY_LOCALE.ru),
    );
    expect(row.textContent).toContain('4 шт.');
  });

  it('links the priced page ahead of an unpriced one', async () => {
    setShop(true);
    const row = await render(FittedPart, {
      props: { pages: [unpriced, priced], name: 'Колодки' },
    });

    expect(links(row)[0]).toBe('/ru/parts/p/ate-13046/');
  });

  it('links the current number when nothing is priced, skipping a superseded one', async () => {
    setShop(false);
    const old = partPage({
      id: 'pi_old',
      slug: 'bosch-old',
      value: 'OLD',
      superseded: true,
    });
    const row = await render(FittedPart, {
      props: { pages: [old, unpriced], name: 'Колодки', heading: true },
    });

    expect(row.querySelector('h3 a')?.getAttribute('href')).toBe(
      '/ru/parts/p/bosch-0986494524/',
    );
  });
});
