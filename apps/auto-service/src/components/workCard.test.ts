import { describe, expect, it } from 'vitest';
import cover from '@/assets/hero-mechanic-wide.jpg';
import type { Work } from '@/utils/works';
import WorkCard from './WorkCard.astro';
import { render } from './renderAstro';

const work = (title: string, year?: number): Work =>
  ({
    id: 'bmw-x3',
    body: '',
    collection: 'works',
    data: {
      title,
      car: 'BMW X3',
      year,
      servicesApplied: ['servicing'],
      parts: [],
      image: cover,
      gallery: [],
      date: new Date('2026-01-01'),
      published: true,
      featured: false,
    },
  }) as unknown as Work;

const card = (props: Record<string, unknown>) =>
  render(WorkCard, { path: '/ru/', props });
const meta = (root: Element) => root.querySelector('span.spec')?.textContent;

describe('WorkCard', () => {
  it('names the car and year under a title that leads with the job', async () => {
    expect(meta(await card({ work: work('Замена масла', 2021) }))).toBe(
      'BMW X3 · 2021',
    );
    expect(meta(await card({ work: work('Замена масла') }))).toBe('BMW X3');
  });

  it('does not repeat the car under a title that already opens with it', async () => {
    expect(
      meta(await card({ work: work('BMW X3: масло в двигателе', 2021) })),
    ).toBeUndefined();
  });

  it('tags the services unless the teaser turns them off', async () => {
    expect(
      (await card({ work: work('Замена масла') })).querySelector('ul li')
        ?.textContent,
    ).toBe('Плановое ТО');
    expect(
      (await card({ work: work('Замена масла'), tags: false })).querySelector(
        'ul',
      ),
    ).toBeNull();
  });

  it('asks for the image width the caller lays it out at', async () => {
    const sizes = (root: Element) =>
      root.querySelector('img')?.getAttribute('sizes');

    expect(sizes(await card({ work: work('x'), sizes: '78vw' }))).toBe('78vw');
    expect(sizes(await card({ work: work('x') }))).toContain('33vw');
  });
});
