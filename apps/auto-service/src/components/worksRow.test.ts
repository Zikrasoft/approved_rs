import { describe, expect, it } from 'vitest';
import cover from '@/assets/mechanic-engine-teardown-wide.jpg';
import type { Work } from '@/utils/works';
import WorksRow from './WorksRow.astro';
import { render } from './renderAstro';

const work = (id: string, title: string, car = 'BMW X3'): Work =>
  ({
    id,
    body: '',
    collection: 'works',
    data: {
      title,
      car,
      year: 2021,
      servicesApplied: ['servicing'],
      parts: [],
      image: cover,
      gallery: [],
      date: new Date('2026-01-01'),
      published: true,
      featured: false,
    },
  }) as unknown as Work;

const works = Array.from({ length: 7 }, (_, i) =>
  work(`work-${i}`, `Замена масла ${i}`),
);
const row = (list: Work[]) =>
  render(WorksRow, {
    path: '/ru/',
    props: { works: list, eyebrow: 'Примеры работ', heading: 'Что починили' },
  });

describe('WorksRow', () => {
  it('renders nothing without a Work to show', async () => {
    expect((await row([])).innerHTML.trim()).toBe('');
  });

  it('scrolls six cards on a phone and shows three on a desktop', async () => {
    const items = [...(await row(works)).querySelectorAll('li')].filter(
      (item) => item.querySelector('a[href^="/ru/works/"]'),
    );

    expect(items).toHaveLength(6);
    expect(items.map((item) => item.classList.contains('lg:hidden'))).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
  });

  it('drops the service tags from the teaser cards', async () => {
    const root = await row(works);

    expect(root.querySelector('a[href="/ru/works/work-0/"] ul')).toBeNull();
  });

  it('links every Work once beside the heading and once under the row', async () => {
    const all = [
      ...(await row(works)).querySelectorAll('a[href="/ru/works/"]'),
    ];

    expect(all.map((link) => link.classList.contains('sm:hidden'))).toEqual([
      false,
      true,
    ]);
    expect(all[0].classList.contains('max-sm:hidden')).toBe(true);
  });
});
