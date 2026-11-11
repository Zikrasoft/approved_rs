import { describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import ServicePage from './[slug].astro';

vi.mock('astro:content', () => ({
  getCollection: vi
    .fn()
    .mockResolvedValue([
      work({ id: 'bmw-x3', servicesApplied: ['diagnostics'], featured: true }),
      work({ id: 'vw-golf', servicesApplied: ['servicing'] }),
    ]),
}));

const { services, home, site } = content('ru');
const page = (slug: string) =>
  render(ServicePage, {
    path: `/ru/services/${slug}/`,
    params: { locale: 'ru', slug },
    props: { slug },
  });
const texts = (root: Element, selector: string) =>
  [...root.querySelectorAll(selector)].map((node) => node.textContent?.trim());

describe('a service page', () => {
  it('names the service in the h1 and keeps the hook under it', async () => {
    const root = await page('diagnostics');

    expect(texts(root, 'h1')).toEqual(['Компьютерная диагностика в Белграде']);
    expect(root.querySelector('h1 + p')?.textContent?.trim()).toBe(
      services.diagnostics.heroTitle,
    );
  });

  it('states the duration and never a price', async () => {
    const root = await page('servicing');
    const facts = root.querySelector('section dl')!;

    expect(texts(facts, 'dt')).toEqual([services.specsDurationLabel]);
    expect(texts(facts, 'dd')).toEqual([services.servicing.duration]);
    expect(root.textContent).not.toContain(services.servicing.priceFrom);
    expect(root.textContent).not.toContain('€');
  });

  it('shows the photo of the Work picked for the service and preloads it', async () => {
    const root = await page('diagnostics');
    const photo = root.querySelector('section img[fetchpriority="high"]')!;
    const preload = root.querySelector('link[rel="preload"][as="image"]');

    expect(photo.getAttribute('src')).toContain(
      'mechanic-engine-teardown-wide',
    );
    expect(photo.getAttribute('alt')).toBe('');
    expect(preload?.getAttribute('imagesrcset')).toBe(
      photo.getAttribute('srcset'),
    );
  });

  it('shows the CarLab workshop, described, where no Work cover fits', async () => {
    const root = await page('engine-gearbox');
    const photo = root.querySelector('section img[fetchpriority="high"]')!;

    expect(photo.getAttribute('src')).toContain('workshop-bay');
    expect(photo.getAttribute('alt')).toBe(site.photos.workshopBay);
    expect(photo.getAttribute('sizes')).toBe(
      '(min-width: 1224px) calc(532px * 1.21), (min-width: 1024px) calc(calc(46.5vw - 19px) * 1.21), calc(100vw - 2.5rem)',
    );
  });

  it('collapses the hero to one column for a service with no real photo', async () => {
    const root = await page('vin-parts-inquiry');

    expect(root.querySelector('section img[fetchpriority="high"]')).toBeNull();
    expect(root.querySelector('link[rel="preload"][as="image"]')).toBeNull();
  });

  it('books the service under its own label in the modal', async () => {
    const root = await page('servicing');
    const book = [...root.querySelectorAll('a')].find(
      (link) => link.textContent?.trim() === services.servicing.cta,
    );

    expect(book?.getAttribute('data-open-lead-modal')).toBe('');
  });

  it('sends the parts visitor to the inquiry form on the page instead', async () => {
    const root = await page('vin-parts-inquiry');
    const send = [...root.querySelectorAll('a')].find(
      (link) => link.textContent?.trim() === services['vin-parts-inquiry'].cta,
    );

    expect(send?.getAttribute('href')).toBe('#lead');
    expect(send?.hasAttribute('data-open-lead-modal')).toBe(false);
    expect(root.querySelector('#lead h2')?.textContent?.trim()).toBe(
      'Подбор запчастей: назовем цену и срок',
    );
  });

  it('puts the symptoms before what is included, both before the body on a phone', async () => {
    const aside = (await page('diagnostics')).querySelector('aside')!;

    expect(aside.classList.contains('max-lg:order-first')).toBe(true);
    expect(texts(aside, 'h2')).toEqual([
      services.diagnostics.signsHeading,
      services.diagnostics.includesHeading,
    ]);
  });

  it('walks through the visit by step titles alone', async () => {
    const section = [
      ...(await page('diagnostics')).querySelectorAll('section'),
    ].find(
      (node) =>
        node.querySelector('h2')?.textContent === services.processHeading,
    )!;
    const steps = [...section.querySelectorAll('ol > li')];

    expect(steps.map((step) => step.querySelector('h3')?.textContent)).toEqual(
      home.process.steps.map((step) => step.title),
    );
    expect(steps.some((step) => step.querySelector('p'))).toBe(false);
  });

  it('shows only the Works done under the service, then books with shared copy', async () => {
    const root = await page('diagnostics');

    expect(
      [...root.querySelectorAll('a[href^="/ru/works/"]')]
        .map((link) => link.getAttribute('href'))
        .filter((href) => href !== '/ru/works/'),
    ).toEqual(['/ru/works/bmw-x3/']);
    expect(root.querySelector('#lead h2')?.textContent?.trim()).toBe(
      'Компьютерная диагностика: запишем на удобное время',
    );
    expect(root.querySelector('#lead p')?.textContent?.trim()).toBe(
      services.ctaBody,
    );
  });

  it('keeps every orange off the body below the hero', async () => {
    const root = await page('servicing');
    const body = [...root.querySelectorAll('main section')].slice(1);

    expect(
      body.flatMap((section) => [
        ...section.querySelectorAll('.text-signal-ink'),
      ]),
    ).toEqual([]);
  });
});
