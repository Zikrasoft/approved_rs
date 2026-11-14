import { getCollection } from 'astro:content';
import { withPlaceholder } from '@podbor/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import type { Locale } from '@/i18n/config';
import { render } from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import MakePage, { getStaticPaths } from './[make].astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

const bmwWorks = Array.from({ length: 7 }, (_, i) =>
  work({ id: `bmw-${i}`, make: 'bmw' }),
);

beforeEach(() => {
  vi.mocked(getCollection).mockResolvedValue([
    ...bmwWorks,
    work({ id: 'golf', make: 'volkswagen', published: false }),
    work({ id: 'brakes' }),
  ] as never);
});

const page = async (locale: Locale = 'ru') => {
  const [path] = (await getStaticPaths()).filter(
    ({ params }) => params.locale === locale && params.make === 'bmw',
  );
  return render(MakePage as never, {
    path: `/${locale}/cars/bmw/`,
    params: path.params,
    props: path.props,
  });
};
const classes = (element: Element | null) =>
  element ? element.className.split(/\s+/) : [];

describe('the Make pages', () => {
  it('exist in every locale for a Make with a published Work and for no other', async () => {
    expect((await getStaticPaths()).map(({ params }) => params)).toEqual([
      { locale: 'ru', make: 'bmw' },
      { locale: 'sr', make: 'bmw' },
      { locale: 'en', make: 'bmw' },
    ]);
  });
});

describe('a Make page', () => {
  it.each(['ru', 'sr', 'en'] as const)(
    'heads with the template naming the make in %s',
    async (locale) => {
      const { make } = content(locale).pages;
      const root = await page(locale);

      expect(root.querySelector('h1')?.textContent?.trim()).toBe(
        withPlaceholder(make.headingTemplate, 'make', 'BMW'),
      );
      expect(root.textContent).toContain(
        withPlaceholder(make.leadTemplate, 'make', 'BMW'),
      );
      expect(root.querySelector('title')?.textContent).toBe(
        withPlaceholder(make.metaTitleTemplate, 'make', 'BMW'),
      );
    },
  );

  it('offers the call and the booking, then the services, then the Works', async () => {
    const root = await page();
    const { make } = content('ru').pages;
    const order = [
      root.querySelector('h1')!,
      root.querySelector('[data-contact-placement="hero"]')!,
      [...root.querySelectorAll('h2')].find(
        (h2) =>
          h2.textContent?.trim() ===
          withPlaceholder(make.servicesHeadingTemplate, 'make', 'BMW'),
      )!,
      [...root.querySelectorAll('h2')].find(
        (h2) =>
          h2.textContent?.trim() ===
          withPlaceholder(make.worksHeadingTemplate, 'make', 'BMW'),
      )!,
    ];

    const all = [...root.querySelectorAll('*')];
    const positions = order.map((node) => all.indexOf(node));

    expect(positions).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('lists what the workshop does with a link to each service', async () => {
    const root = await page();

    expect(
      root.querySelector('a[href="/ru/services/diagnostics/"]'),
    ).not.toBeNull();
  });

  it('shows six of the make’s Works and links the Works list narrowed to it', async () => {
    const root = await page();

    expect(root.querySelectorAll('[data-filter-item]')).toHaveLength(6);
    expect(
      root.querySelector('a[href="/ru/works/?make=bmw"]')?.textContent?.trim(),
    ).toBe(
      withPlaceholder(content('ru').pages.make.worksAllTemplate, 'make', 'BMW'),
    );
  });

  it('dials on a touchscreen and offers a callback on a mouse', async () => {
    const hero = (await page()).querySelector(
      '[data-contact-placement="hero"]',
    )!;
    const call = hero.querySelector('a[href^="tel:"]');
    const callback = hero.querySelector('a[data-open-lead-modal="phone"]');

    expect(classes(call)).toContain('pointer-fine:hidden!');
    expect(classes(callback)).toContain('pointer-coarse:hidden!');
  });
});
