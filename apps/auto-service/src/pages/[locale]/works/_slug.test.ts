import { getCollection } from 'astro:content';
import { describe, expect, it, vi } from 'vitest';
import tall from '@/assets/mechanic-engine-teardown-tall.jpg';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import WorkPage, { getStaticPaths } from './[slug].astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

const { pages } = content('ru');
const page = (
  current = work({ body: 'Что нашли на диагностике.' }),
  props: Record<string, unknown> = {},
) =>
  render(WorkPage, {
    path: `/ru/works/${current.id}/`,
    params: { locale: 'ru', slug: current.id },
    props: { work: current, related: [], parts: [], ...props },
  });
const order = (root: Element, ...selectors: string[]) =>
  selectors.map((selector) =>
    [...root.querySelectorAll('*')].indexOf(root.querySelector(selector)!),
  );

describe('the work pages', () => {
  it('relate each Work to the others with the featured ones first', async () => {
    vi.mocked(getCollection).mockResolvedValue([
      work({ id: 'newest', date: new Date('2026-10-01') }),
      work({ id: 'picked', featured: true }),
      work({ id: 'current', date: new Date('2026-01-01') }),
    ] as never);
    const paths = await getStaticPaths();
    const current = paths.find(
      (path) => path.params.slug === 'current' && path.params.locale === 'ru',
    )!;

    expect(current.props.related.map((entry) => entry.id)).toEqual([
      'picked',
      'newest',
    ]);
  });
});

describe('a work page', () => {
  it('heads the page with the title alone, then the cover with labelled facts', async () => {
    const root = await page();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Замена масла');
    expect(
      root.querySelector('h1')!.closest('section')!.querySelector('.eyebrow'),
    ).toBeNull();
    expect(root.textContent).toContain(pages.works.factCar);
  });

  it('opens the door to a similar case only after the story', async () => {
    const [story, door] = order(
      await page(),
      '.prose-shop',
      '[data-depth-door]',
    );

    expect(story).toBeLessThan(door);
  });

  it('keeps the door secondary, the booking below owns the orange', async () => {
    const door = (await page()).querySelector('[data-depth-door] a')!;

    expect(door.classList.contains('btn-secondary')).toBe(true);
  });

  it('opens the gallery in a lightbox, and leaves it out without photos', async () => {
    expect(
      (await page(work({ gallery: [tall] }))).querySelector(
        'gallery-lightbox [data-lightbox-item]',
      ),
    ).not.toBeNull();
    expect((await page()).querySelector('gallery-lightbox')).toBeNull();
  });

  it('lists the parts used, with a page link where the catalogue has one', async () => {
    const root = await page(work(), {
      parts: [
        { brand: 'Bosch', number: '0 986 494 524', slug: 'bosch-0986494524' },
        { brand: 'Febi', number: '12345', slug: null },
      ],
    });

    expect(root.textContent).toContain(pages.works.partsHeading);
    expect(
      root.querySelector('a[href="/ru/parts/p/bosch-0986494524/"]'),
    ).not.toBeNull();
    expect(root.textContent).toContain('Febi');
  });

  it('never shows what the parts cost', async () => {
    const root = await page(
      work({ servicesApplied: ['vin-parts-inquiry'], priceRsd: 12500 }),
    );

    expect(root.textContent).not.toMatch(/12[\s.,]?500/);
  });

  it('shows related Works under their own heading, and nothing without any', async () => {
    const related = await page(work(), {
      related: [work({ id: 'vw-golf', title: 'VW Golf' })],
    });

    expect(
      related.querySelector('a[href="/ru/works/vw-golf/"]'),
    ).not.toBeNull();
    expect(related.textContent).toContain(pages.works.relatedHeading);
    expect((await page()).textContent).not.toContain(
      pages.works.relatedHeading,
    );
  });

  it('offers no promo banner', async () => {
    expect((await page()).textContent).not.toContain('Полезная информация');
  });

  it('books a parts sourcing Work as a parts inquiry', async () => {
    const root = await page(work({ servicesApplied: ['vin-parts-inquiry'] }));

    expect(root.querySelector('#lead h2')?.textContent?.trim()).toBe(
      pages.works.sourcingCta.heading,
    );
  });
});
