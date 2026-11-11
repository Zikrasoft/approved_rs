import { describe, expect, it } from 'vitest';
import tall from '@/assets/mechanic-engine-teardown-tall.jpg';
import WorkCover from './WorkCover.astro';
import { render } from './renderAstro';
import { work } from './workFixture';

const cover = (over: Parameters<typeof work>[0] = {}) =>
  render(WorkCover, { path: '/ru/works/bmw-x3/', props: { work: work(over) } });
const facts = (root: Element) =>
  Object.fromEntries(
    [...root.querySelectorAll('dl > div')].map((fact) => [
      fact.querySelector('dt')?.textContent?.trim(),
      fact.querySelector('dd')?.textContent?.trim(),
    ]),
  );
const widths = (root: Element) =>
  [
    ...root
      .querySelector('img')!
      .getAttribute('srcset')!
      .matchAll(/ (\d+)w/g),
  ].map(([, width]) => Number(width));

describe('WorkCover with a landscape photo', () => {
  it('shows the whole frame at its own aspect, as wide as the page', async () => {
    const root = await cover();
    const image = root.querySelector('img')!;

    expect(image.classList.contains('h-auto')).toBe(true);
    expect(image.className).not.toContain('aspect-');
    expect(image.getAttribute('sizes')).toBe(
      '(min-width: 1224px) 1144px, calc(100vw - 2.5rem)',
    );
    expect(Math.max(...widths(root))).toBe(1280);
  });

  it('lays the facts in three columns under the photo', async () => {
    const root = await cover();

    expect(root.querySelector('section > div')!.className).not.toContain(
      'lg:grid-cols',
    );
    expect(root.querySelector('dl')!.classList.contains('sm:grid-cols-3')).toBe(
      true,
    );
  });
});

describe('WorkCover with a portrait photo', () => {
  it('crops to 4:5 beside the facts and asks for no more than the source width', async () => {
    const root = await cover({ image: tall });
    const image = root.querySelector('img')!;

    expect(image.classList.contains('aspect-[4/5]')).toBe(true);
    expect(image.getAttribute('sizes')).toBe(
      '(min-width: 1024px) 416px, calc(100vw - 2.5rem)',
    );
    expect(Math.max(...widths(root))).toBe(720);
    expect(root.querySelector('section > div')!.className).toContain(
      'lg:grid-cols-[26rem_minmax(0,1fr)]',
    );
    expect(root.querySelector('dl')!.classList.contains('sm:grid-cols-3')).toBe(
      false,
    );
  });
});

describe('WorkCover story', () => {
  it('sets the story under the facts, beside a portrait photo', async () => {
    const root = await render(WorkCover, {
      path: '/ru/works/bmw-x3/',
      props: { work: work({ image: tall }) },
      slots: { default: '<p id="story">Что нашли.</p>' },
    });

    expect(root.querySelector('dl + #story')).not.toBeNull();
  });
});

describe('WorkCover facts', () => {
  it('labels the car with its year, the month of the job and the services', async () => {
    const root = await cover({ servicesApplied: ['servicing', 'diagnostics'] });

    expect(facts(root)).toEqual({
      Машина: 'BMW X3, 2021',
      Работа: 'сентябрь 2026 г.',
      Услуги: 'Плановое ТОКомпьютерная диагностика',
    });
    expect(
      [...root.querySelectorAll('dd a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['/ru/services/servicing/', '/ru/services/diagnostics/']);
  });

  it('names the car alone without a year and drops the services fact without services', async () => {
    expect(
      facts(await cover({ year: undefined, servicesApplied: [] })),
    ).toEqual({ Машина: 'BMW X3', Работа: 'сентябрь 2026 г.' });
  });
});
