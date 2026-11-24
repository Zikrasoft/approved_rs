import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { content } from '@/i18n/content';
import { formatPhone } from '@podbor/site-kit/format-phone';
import { PHONE_NUMBER } from '@/utils/constants';
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

  it('drops the inline header search on the parts search page, which has its own', async () => {
    setShop(false);
    const root = await header('/ru/parts/search/');

    expect(root.querySelector('header catalogue-search')).toBeNull();
    expect(searchButton(root).classList.contains('min-[1360px]:hidden')).toBe(
      false,
    );
  });

  it.each(['/ru/', '/ru/services/', '/ru/parts/'])(
    'shows the inline header search on %s only where no hero search sits below it',
    async (path) => {
      setShop(false);
      const root = await header(path);
      const field = root.querySelector(
        'header catalogue-search',
      )!.parentElement!;

      expect(field.classList).toContain('min-[1360px]:block');
      expect(field.classList).toContain(
        '[body:has([data-hero-parts-search])_&]:hidden',
      );
      expect([...searchButton(root).classList]).toEqual(
        expect.arrayContaining([
          'min-[1360px]:hidden',
          '[body:has([data-hero-parts-search])_&]:min-[1360px]:flex',
        ]),
      );
      expect(searchButton(root).getAttribute('href')).toBe('/ru/parts/');
    },
  );

  it('links the about page from the primary nav instead of an in-page anchor', async () => {
    setShop(false);
    const root = await header('/ru/services/');
    const labels = [...root.querySelectorAll('nav[aria-label] a')].map(
      (link) => [link.textContent?.trim(), link.getAttribute('href')],
    );

    expect(labels).toContainEqual([site.nav.about, '/ru/about/']);
    expect(labels.map(([, href]) => href)).not.toContain('/ru/#process');
  });

  it('links the Make list from the desktop and the mobile nav under the footer label', async () => {
    setShop(false);
    const root = await header('/ru/cars/bmw/');
    const links = [...root.querySelectorAll('nav[aria-label]')].map((nav) =>
      nav.querySelector('a[href="/ru/cars/"]'),
    );

    expect(links.map((link) => link?.textContent?.trim())).toEqual([
      content('ru').pages.cars.navLabel,
      content('ru').pages.cars.navLabel,
    ]);
    expect(links.map((link) => link?.getAttribute('aria-current'))).toEqual([
      'true',
      'true',
    ]);
  });

  describe('the desktop language switcher', () => {
    const switcher = async (path = '/ru/services/') => {
      setShop(false);
      const lang = (await header(path)).querySelector('header carlab-lang')!;
      const button = lang.querySelector('button[popovertarget]')!;
      const list = lang.querySelector(
        `#${button.getAttribute('popovertarget')}`,
      )!;
      return { button, list };
    };

    it('shows only the current locale on a button that opens the list', async () => {
      const { button, list } = await switcher('/sr/services/');

      expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        `${content('sr').site.header.languageLabel}: sr`,
      );
      expect(button.querySelector('.sr-only')).not.toBeNull();
      expect(list.hasAttribute('popover')).toBe(true);
      expect(
        button.closest('header')!.querySelectorAll('a[hreflang]'),
      ).toHaveLength(list.querySelectorAll('a[hreflang]').length);
    });

    it('names every language and checks the current one', async () => {
      const { list } = await switcher();
      const options = [...list.querySelectorAll('a')];

      expect(
        options.map((option) => [
          option.textContent?.trim(),
          option.getAttribute('href'),
          option.getAttribute('data-lang-choice'),
          option.getAttribute('aria-current'),
          option.querySelector('svg') !== null,
        ]),
      ).toEqual([
        ['Русский', '/ru/services/', 'ru', 'true', true],
        ['Srpski', '/sr/services/', 'sr', null, false],
        ['English', '/en/services/', 'en', null, false],
      ]);
      expect(
        options.every((option) => option.classList.contains('min-h-11')),
      ).toBe(true);
    });

    it('hides the language suggestion while the list is open', async () => {
      const { list } = await switcher();
      const wrapper = list.closest('carlab-lang')!.parentElement!;

      expect(wrapper.querySelector('language-suggestion')).not.toBeNull();
      expect(wrapper.classList).toContain(
        '[&:has(:popover-open)_language-suggestion]:hidden',
      );
    });

    it('leaves the mobile menu its own row of locale codes', async () => {
      setShop(false);
      const menu = (await header('/ru/services/')).querySelector('#site-menu')!;

      expect(
        [...menu.querySelectorAll('carlab-lang a')].map((a) =>
          a.textContent?.trim(),
        ),
      ).toEqual(['ru', 'sr', 'en']);
      expect(menu.querySelector('[popover]')).toBeNull();
    });
  });

  it('puts the make list in the desktop nav and keeps contacts in the mobile menu', async () => {
    setShop(false);
    const root = await header('/ru/services/');
    const hrefs = (label: string) =>
      [...root.querySelectorAll(`nav[aria-label="${label}"] a`)].map((link) =>
        link.getAttribute('href'),
      );
    const cars = content('ru').pages.cars.navLabel;

    expect(hrefs(site.common.primaryNavLabel)).toEqual([
      '/ru/services/',
      '/ru/parts/',
      '/ru/cars/',
      '/ru/works/',
      '/ru/about/',
    ]);
    expect(hrefs(site.common.mobileNavLabel)).toEqual([
      '/ru/services/',
      '/ru/parts/',
      '/ru/cars/',
      '/ru/works/',
      '/ru/about/',
      '/ru/contact/',
    ]);
    expect(
      root
        .querySelector(
          `nav[aria-label="${site.common.primaryNavLabel}"] a[href="/ru/cars/"]`,
        )
        ?.textContent?.trim(),
    ).toBe(cars);
  });

  it.each(['/ru/', '/ru/services/', '/ru/parts/'])(
    'leaves booking and callback buttons out of the header bar on %s',
    async (path) => {
      setShop(false);
      const bar = (await header(path)).querySelector('header')!;

      expect(bar.querySelector('cta-reveal')).toBeNull();
      expect(bar.querySelector('[data-open-lead-modal]')).toBeNull();
      expect(bar.textContent).not.toContain(site.header.cta);
    },
  );

  it('offers a touchscreen the call icon and a mouse the digits, under the header placement', async () => {
    setShop(false);
    const root = await header('/ru/services/');
    const call = root.querySelector('header a[href^="tel:"]')!;
    const digits = call.nextElementSibling!;

    expect(call.getAttribute('aria-label')).toBe(site.channels.call);
    expect(call.classList.contains('pointer-fine:hidden!')).toBe(true);
    expect(digits.textContent).toContain(formatPhone(PHONE_NUMBER));
    expect(digits.classList.contains('pointer-coarse:hidden!')).toBe(true);
    expect(call.closest('[data-contact-placement="header"]')).not.toBeNull();
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
