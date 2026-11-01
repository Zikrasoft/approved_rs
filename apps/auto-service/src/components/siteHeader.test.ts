import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { PARTS_INQUIRY_OPEN_ATTRIBUTE } from '@/scripts/partsList';
import SiteHeader from './SiteHeader.astro';
import { render, setShop } from './renderAstro';

const site = content('ru').site;
const searchCopy = content('ru').partsSearch;

afterEach(() => {
  vi.unstubAllEnvs();
});

const header = (path: string) => render(SiteHeader, { path });

const basket = (root: Element) => root.querySelector('cart-badge a') as Element;

const searchButton = (root: Element) =>
  root.querySelector(`a[aria-label="${searchCopy.openSearch}"]`) as Element;

describe('SiteHeader', () => {
  it('turns the cart into the «Заявка» inquiry entry on parts pages while the shop is closed', async () => {
    setShop(false);
    const root = await header('/ru/parts/');
    const entry = basket(root);

    expect(entry.getAttribute('href')).toBe('/ru/parts/#inquiry');
    expect(entry.hasAttribute(PARTS_INQUIRY_OPEN_ATTRIBUTE)).toBe(true);
    expect(entry.querySelector('span[aria-hidden="true"]')?.textContent).toBe(
      site.header.partsCta,
    );
    expect(entry.querySelector('.sr-only')?.textContent).toBe(
      content('ru').pages.partsInquiry.listHeading,
    );
    expect(root.querySelector('cart-badge')?.hasAttribute('hidden')).toBe(
      false,
    );
    expect(
      root.querySelector('cart-badge')?.hasAttribute('data-parts-list'),
    ).toBe(true);
  });

  it('keeps the inquiry list behind a hidden icon off the parts pages while the shop is closed', async () => {
    setShop(false);
    const root = await header('/ru/services/');
    const badge = root.querySelector('cart-badge');

    expect(badge?.hasAttribute('hidden')).toBe(true);
    expect(badge?.hasAttribute('data-reveal-when-filled')).toBe(true);
    expect(basket(root).querySelector('span[aria-hidden="true"]')).toBeNull();
    expect(basket(root).hasAttribute(PARTS_INQUIRY_OPEN_ATTRIBUTE)).toBe(true);
    expect(
      root.querySelector('[data-open-lead-modal]')?.textContent?.trim(),
    ).toBe(site.header.cta);
  });

  it('links the cart once the shop is open', async () => {
    setShop(true);
    const root = await header('/ru/parts/');
    const entry = basket(root);

    expect(entry.getAttribute('href')).toBe('/ru/parts/cart/');
    expect(entry.hasAttribute(PARTS_INQUIRY_OPEN_ATTRIBUTE)).toBe(false);
    expect(entry.querySelector('.sr-only')?.textContent).toBe(
      content('ru').shopCart.cartLink,
    );
    expect(
      root.querySelector('cart-badge')?.hasAttribute('data-parts-list'),
    ).toBe(false);
  });

  it.each(['/ru/', '/ru/parts/search/'])(
    'drops the inline header search on %s, which has its own',
    async (path) => {
      setShop(false);
      const root = await header(path);

      expect(root.querySelector('div.xl\\:block catalogue-search')).toBeNull();
      expect(searchButton(root).classList.contains('xl:hidden')).toBe(false);
    },
  );

  it('keeps the inline header search on other pages', async () => {
    setShop(false);
    const root = await header('/ru/parts/');

    expect(root.querySelector('div.xl\\:block')).not.toBeNull();
    expect(searchButton(root).classList.contains('xl:hidden')).toBe(true);
    expect(searchButton(root).getAttribute('href')).toBe('/ru/parts/');
  });
});
