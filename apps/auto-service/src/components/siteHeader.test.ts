import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { content } from '@/i18n/content';
import { PARTS_INQUIRY_OPEN_ATTRIBUTE } from '@/scripts/partsList';
import { CART_STORAGE_KEY, PARTS_LIST_STORAGE_KEY } from '@/scripts/cartBadge';
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

      expect(
        root.querySelector('div.min-\\[1360px\\]\\:block catalogue-search'),
      ).toBeNull();
      expect(searchButton(root).classList.contains('min-[1360px]:hidden')).toBe(
        false,
      );
    },
  );

  it('keeps the inline header search on other pages', async () => {
    setShop(false);
    const root = await header('/ru/parts/');

    expect(root.querySelector('div.min-\\[1360px\\]\\:block')).not.toBeNull();
    expect(searchButton(root).classList.contains('min-[1360px]:hidden')).toBe(
      true,
    );
    expect(searchButton(root).getAttribute('href')).toBe('/ru/parts/');
  });

  it('links the about page from the primary nav instead of an in-page anchor', async () => {
    setShop(false);
    const root = await header('/ru/services/');
    const labels = [...root.querySelectorAll('nav[aria-label] a')].map(
      (link) => [link.textContent?.trim(), link.getAttribute('href')],
    );

    expect(labels).toContainEqual([site.nav.about, '/ru/about/']);
    expect(labels.map(([, href]) => href)).not.toContain('/ru/#process');
  });

  it.each(['/ru/', '/ru/services/', '/ru/parts/'])(
    'leaves booking, callback and call buttons out of the header bar on %s',
    async (path) => {
      setShop(false);
      const bar = (await header(path)).querySelector('header')!;

      expect(bar.querySelector('cta-reveal')).toBeNull();
      expect(bar.querySelector('[data-open-lead-modal]')).toBeNull();
      expect(bar.querySelector('a[href^="tel:"]')).toBeNull();
      expect(bar.textContent).not.toContain(site.header.cta);
    },
  );

  it('puts the address and hours in the mobile menu before the channels', async () => {
    setShop(false);
    const menu = (await header('/ru/services/')).querySelector('#site-menu')!;
    const address = menu.querySelector('a[href^="https://maps.google.com"]')!;

    expect(address.textContent).toContain('Jovana Ćirilova 23a');
    expect(menu.textContent).toContain(site.hours.week);
    expect(
      address.compareDocumentPosition(
        menu.querySelector('[data-contact-channel]')!,
      ) & 4,
    ).toBeTruthy();
  });

  describe('before any module script runs', () => {
    const parse = async (path: string, stored?: [string, string]) => {
      const html = (await header(path)).innerHTML;
      return new JSDOM(html, {
        url: 'https://carlab.rs/',
        runScripts: 'dangerously',
        beforeParse: (window) => {
          if (stored) window.localStorage.setItem(...stored);
        },
      }).window.document.querySelector<HTMLElement>('cart-badge')!;
    };

    it('shows the inquiry list icon off the parts pages once it holds a part', async () => {
      setShop(false);
      const badge = await parse('/ru/services/', [
        PARTS_LIST_STORAGE_KEY,
        JSON.stringify([{ slug: 'febi-37511' }]),
      ]);

      expect(badge.hidden).toBe(false);
    });

    it('shows the cart icon once the open shop cart holds a line', async () => {
      setShop(true);
      const badge = await parse('/ru/services/', [
        CART_STORAGE_KEY,
        JSON.stringify({ count: 2 }),
      ]);

      expect(badge.hidden).toBe(false);
    });

    it.each([
      ['nothing is stored', undefined],
      ['the list is empty', [PARTS_LIST_STORAGE_KEY, '[]']],
      ['the stored list is unreadable', [PARTS_LIST_STORAGE_KEY, '{oops']],
    ] as const)('keeps the icon hidden when %s', async (_, stored) => {
      setShop(false);
      const badge = await parse(
        '/ru/services/',
        stored as [string, string] | undefined,
      );

      expect(badge.hidden).toBe(true);
    });

    it('never hides the always-present parts page entry', async () => {
      setShop(false);
      const badge = await parse('/ru/parts/');

      expect(badge.hidden).toBe(false);
      expect([...badge.classList].join(' ')).not.toMatch(/:hidden/);
      expect(badge.querySelector('[data-count]')!.classList).not.toContain(
        'lg:static',
      );
    });
  });
});
