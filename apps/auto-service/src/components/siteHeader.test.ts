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
      root.querySelector('[data-open-lead-modal=""]')?.textContent?.trim(),
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

  it('reveals a mouse callback beside the booking once the page contact block scrolls away', async () => {
    setShop(false);
    const reveal = (await header('/ru/services/')).querySelector('cta-reveal')!;
    const [call, callback, booking] = [...reveal.querySelectorAll('a')];

    expect(call.getAttribute('href')).toBe('tel:+381677210533');
    expect(call.classList.contains('pointer-fine:hidden!')).toBe(true);
    expect(call.textContent).not.toContain('+381');
    expect(callback.getAttribute('data-open-lead-modal')).toBe('phone');
    expect(callback.textContent?.trim()).toBe(site.header.callback);
    expect(callback.classList.contains('pointer-coarse:hidden!')).toBe(true);
    expect(booking.textContent?.trim()).toBe(site.header.cta);
  });

  it('keeps the callback out of the parts reveal', async () => {
    setShop(false);
    const reveal = (await header('/ru/parts/')).querySelector('cta-reveal')!;

    expect(reveal.querySelector('[data-open-lead-modal]')).toBeNull();
    expect(reveal.querySelector('[href^="tel:"]')).toBeNull();
  });

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
});
