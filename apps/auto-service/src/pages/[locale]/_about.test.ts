import { describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import AboutPage from './about.astro';

vi.mock('astro:content', () => ({
  getCollection: vi
    .fn()
    .mockResolvedValue([
      work({ id: 'a', car: 'BMW X3' }),
      work({ id: 'b', car: 'SEAT LEON' }),
      work({ id: 'c', car: 'Обслуживание тормозов' }),
    ]),
}));

const { pages, site } = content('ru');
const about = pages.about;
const page = () =>
  render(AboutPage as never, { path: '/ru/about/', params: { locale: 'ru' } });
const headings = (root: Element) =>
  [...root.querySelectorAll('h2')].map((h) => h.textContent?.trim());

describe('the about page', () => {
  it('introduces the service, not the website', async () => {
    const root = await page();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe(about.heading);
    expect(root.textContent).toContain(about.lead);
    expect(root.textContent).not.toContain('переводятся автоматически');
    expect(root.querySelector('main')?.textContent).not.toContain('Zikrasoft');
  });

  it('keeps the team block hidden until the owner fills it', async () => {
    expect(about.team).toEqual([]);
    expect(headings(await page())).not.toContain(about.teamHeading);
  });

  it('lists the equipment the site already states', async () => {
    const root = await page();

    expect(headings(root)).toContain(about.equipmentHeading);
    about.equipment.forEach((item) => expect(root.textContent).toContain(item));
  });

  it('names the makes from the Works and links the BMW page and every Work', async () => {
    const root = await page();
    const makes = [...root.querySelectorAll('p')].filter(
      (line) => line.textContent?.trim() === 'BMW, Seat',
    );

    expect(makes).toHaveLength(1);
    expect(root.querySelector('.chip')).toBeNull();
    expect(root.querySelector('a[href="/ru/bmw/"]')?.textContent?.trim()).toBe(
      pages.bmw.heading,
    );
    expect(
      [...root.querySelectorAll('a[href="/ru/works/"]')].some(
        (link) => link.textContent?.trim() === site.common.allWorks,
      ),
    ).toBe(true);
  });

  it('ends with the visit panel and keeps who owns the site', async () => {
    const root = await page();

    expect(headings(root)).toContain(about.ownerHeading);
    expect(
      root.querySelector('[data-contact-placement="visit"] h2')?.textContent,
    ).toBe(site.visit.heading);
    expect(
      root
        .querySelector('[data-contact-placement="visit"] img')
        ?.getAttribute('alt'),
    ).toBe(site.photos.facade);
  });

  it('offers no call or booking above the facts', async () => {
    const hero = (await page()).querySelector('section')!;

    expect(
      hero.querySelector('[data-open-lead-modal], a[href^="tel:"]'),
    ).toBeNull();
  });

  it('opens on the workshop bay and preloads it', async () => {
    const root = await page();
    const photo = root.querySelector('section img[fetchpriority="high"]')!;

    expect(photo.getAttribute('src')).toContain('workshop-bay');
    expect(photo.getAttribute('alt')).toBe(site.photos.workshopBay);
    expect(
      root
        .querySelector('link[rel="preload"][as="image"]')
        ?.getAttribute('imagesrcset'),
    ).toBe(photo.getAttribute('srcset'));
  });

  it('shows the CarLab sign on the workshop wall at no more than 320 css px', async () => {
    const sign = [...(await page()).querySelectorAll('img')].find((image) =>
      image.getAttribute('src')?.includes('workshop-wall-sign'),
    )!;

    expect(sign.getAttribute('alt')).toBe(site.photos.wallSign);
    expect(sign.getAttribute('sizes')).toBe('20rem');
    expect(sign.className).toContain('max-w-80');
  });
});
