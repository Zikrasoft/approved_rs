import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { isOrange, orangeIn, render, setShop } from '@/components/renderAstro';
import PartsHub from './index.astro';

const copy = content('ru').pages.partsInquiry;

const category = (slug: string, empty: boolean) => ({
  id: `category_${slug}`,
  slug,
  name: slug,
  text: `${slug} lead.`,
  translations: null,
  maintenance_kit: false,
  kit_rank: 0,
  service_label: null,
  service_price: null,
  service_note: null,
  installation_price: null,
  image: null,
  fields: [],
  empty,
});

const hub = () =>
  render(PartsHub, {
    path: '/ru/parts/',
    params: { locale: 'ru' },
    props: {
      categories: [category('batteries', false), category('wipers', true)],
      makes: [],
    },
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the parts hub', () => {
  it('opens an inquiry for a category with no parts yet and browses one with parts', async () => {
    setShop(false);
    const root = await hub();
    const tile = (slug: string) =>
      [...root.querySelectorAll('a.card')].find((link) =>
        link.getAttribute('href')?.startsWith(`/ru/parts/c/${slug}/`),
      );

    expect(tile('wipers')?.getAttribute('href')).toBe(
      '/ru/parts/c/wipers/#inquiry',
    );
    expect(tile('wipers')?.textContent).toContain(copy.categoryOrderCta);
    expect(tile('batteries')?.getAttribute('href')).toBe(
      '/ru/parts/c/batteries/',
    );
    expect(tile('batteries')?.textContent).toContain(copy.categoryCta);
    expect(tile('batteries')?.textContent).toContain('batteries lead.');
  });

  it('keeps its links in ink so the inquiry stays the one orange action', async () => {
    setShop(false);
    const root = await render(PartsHub, {
      path: '/ru/parts/',
      params: { locale: 'ru' },
      props: {
        categories: [category('batteries', false), category('wipers', true)],
        makes: [{ slug: 'bmw', name: 'BMW' }],
      },
    });
    const links = [
      ...root.querySelectorAll('a.card'),
      root.querySelector('a[href="/ru/parts/makes/"]')!,
      root.querySelector('cart-badge a')!,
    ];

    expect(links.flatMap(orangeIn)).toEqual([]);
    expect(
      links.filter(isOrange).map((link) => link.getAttribute('href')),
    ).toEqual([]);
  });

  it('keeps the cart link for preview only while the shop is closed', async () => {
    setShop(false);
    const root = await hub();

    expect(
      root
        .querySelector('cart-badge[data-reveal-when-filled]')
        ?.hasAttribute('data-preview-only'),
    ).toBe(true);
  });

  it('shows the cart link to everyone once the shop is open', async () => {
    setShop(true);
    const root = await hub();

    expect(
      root
        .querySelector('cart-badge[data-reveal-when-filled]')
        ?.hasAttribute('data-preview-only'),
    ).toBe(false);
  });
});
