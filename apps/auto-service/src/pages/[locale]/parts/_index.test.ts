import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import {
  isOrange,
  orangeIn,
  partPage,
  render,
  setShop,
} from '@/components/renderAstro';
import PartsHub from './index.astro';

const copy = content('ru').pages.partsInquiry;

const category = (slug: string, empty: boolean, demand = 0) => ({
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
  demand,
});

const hub = (
  categories = [category('batteries', false), category('wipers', true)],
  popular: ReturnType<typeof partPage>[] = [],
) =>
  render(PartsHub, {
    path: '/ru/parts/',
    params: { locale: 'ru' },
    props: { categories, makes: [], popular },
  });

const tileOrder = (root: Element) =>
  [...root.querySelectorAll('a.card h3')].map((title) => title.textContent);

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
        popular: [],
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

  it('lists the most demanded categories first', async () => {
    setShop(false);
    const root = await hub([
      category('batteries', false, 3),
      category('wipers', true),
      category('brakes', false, 11),
    ]);

    expect(tileOrder(root)).toEqual(['brakes', 'batteries', 'wipers']);
  });

  it('keeps the categories in their own order while nothing is demanded', async () => {
    setShop(false);
    const root = await hub([
      category('wipers', true),
      category('batteries', false),
      category('brakes', false),
    ]);

    expect(tileOrder(root)).toEqual(['wipers', 'batteries', 'brakes']);
  });

  it('shows what is often ordered once two parts have real demand, and nothing before', async () => {
    setShop(false);
    const popular = (id: string, score: number) =>
      partPage({
        id,
        slug: `bosch-${id}`,
        demand: { score, popular: true, top: false },
        part: { ...partPage().part, id: `part_${id}` },
      });
    const heading = (root: Element) =>
      [...root.querySelectorAll('h2')].map((title) =>
        title.textContent?.trim(),
      );
    const popularHeading = content('ru').partsSearch.popularHeading;

    expect(heading(await hub(undefined, [popular('a', 6)]))).not.toContain(
      popularHeading,
    );
    expect(
      heading(await hub(undefined, [popular('a', 6), popular('b', 9)])),
    ).toContain(popularHeading);
  });
});
