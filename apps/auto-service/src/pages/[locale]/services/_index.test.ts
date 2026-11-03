import { describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import ServicesIndex from './index.astro';

vi.mock('astro:content', () => ({
  getCollection: vi.fn().mockResolvedValue([work()]),
}));

const { services, site } = content('ru');
const page = () =>
  render(ServicesIndex as never, {
    path: '/ru/services/',
    params: { locale: 'ru' },
  });

describe('the services index', () => {
  it('opens on the graphite panel with the call and the address', async () => {
    const root = await page();
    const hero = root.querySelector('section')!;

    expect(hero.querySelector('h1')?.textContent?.trim()).toBe(
      services.indexHeading,
    );
    expect(hero.querySelector('h1 + p')?.textContent?.trim()).toBe(
      services.indexLead,
    );
    expect(hero.querySelector('.bg-panel')).not.toBeNull();
    expect(hero.querySelector('a[href^="tel:"]')).not.toBeNull();
    expect(hero.textContent).toContain('Jovana Ćirilova 23a');
  });

  it('shows the workshop bay beside the hero and preloads it', async () => {
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

  it('lists the services, the Works and the booking, without the process block', async () => {
    const root = await page();

    expect(
      root.querySelectorAll('a[href^="/ru/services/"]').length,
    ).toBeGreaterThan(6);
    expect(root.querySelector('a[href="/ru/works/bmw-x3/"]')).not.toBeNull();
    expect(root.querySelector('#lead')).not.toBeNull();
    expect(root.textContent).not.toContain(
      content('ru').home.process.steps[0].title,
    );
  });
});
