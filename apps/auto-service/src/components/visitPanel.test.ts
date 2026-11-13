import { describe, expect, it } from 'vitest';
import facadeImage from '@/assets/workshop-facade.jpg';
import { content } from '@/i18n/content';
import { visitPhoto } from '@/utils/panelPhoto';
import VisitPanel from './VisitPanel.astro';
import { render } from './renderAstro';

const site = content('ru').site;
const facade = { image: facadeImage, alt: site.photos.facade };
const panel = (props: Record<string, unknown> = {}, slots = {}) =>
  render(VisitPanel, {
    path: '/ru/',
    props: { heading: site.visit.heading, ...props },
    slots,
  });

describe('VisitPanel', () => {
  it('is a visit region the floating CTA hides behind', async () => {
    const section = (await panel()).querySelector('section')!;

    expect(section.getAttribute('data-contact-placement')).toBe('visit');
    expect(section.hasAttribute('data-contact-cta')).toBe(true);
  });

  it('heads the block with an h2 unless the page makes it the h1', async () => {
    expect((await panel()).querySelector('h2')?.textContent).toBe(
      site.visit.heading,
    );
    expect((await panel({ as: 'h1' })).querySelector('h1')?.textContent).toBe(
      site.visit.heading,
    );
  });

  it('lists the owner facts under the address', async () => {
    const facts = [...(await panel()).querySelectorAll('li')].map((item) =>
      item.textContent?.trim(),
    );

    expect(facts).toEqual(site.visit.facts);
  });

  it('tells the visitor they can wait for the repair on site', async () => {
    const facts = [...(await panel()).querySelectorAll('li')].map((item) =>
      item.textContent?.trim(),
    );

    expect(facts).toContain('Ремонт можно подождать у нас, есть диван и кофе');
  });

  it('leads with the orange call and offers a route to the garage', async () => {
    const root = await panel();
    const call = root.querySelector('a[href^="tel:"]')!;
    const route = root.querySelector(
      'a[href^="https://www.google.com/maps/dir/"]',
    )!;

    expect(call.classList.contains('btn-primary')).toBe(true);
    expect(
      root
        .querySelector('[data-open-lead-modal="phone"]')
        ?.classList.contains('btn-primary'),
    ).toBe(true);
    expect(route.getAttribute('href')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=44.8054581,20.4858424',
    );
    expect(route.textContent?.trim()).toBe(site.visit.route);
    expect(route.classList.contains('btn-on-panel')).toBe(true);
  });

  it('fills the right column with the garage entrance, edge to edge', async () => {
    const grid = (await panel()).querySelector('section > div')!;
    const picture = grid.querySelector(':scope > picture')!;
    const image = picture.querySelector('img')!;

    expect([...grid.classList]).toEqual(
      expect.arrayContaining(['lg:grid-cols-2', 'overflow-hidden']),
    );
    expect(picture.classList.contains('lg:col-start-2')).toBe(true);
    expect(image.classList.contains('lg:h-full')).toBe(true);
    expect(image.getAttribute('src')).toContain('workshop-facade');
    expect(image.getAttribute('alt')).toBe(site.photos.facade);
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('sizes')).toBe((await visitPhoto(facade)).sizes);
  });

  it('lays the one map under the photo and the address, across the whole panel', async () => {
    const grid = (await panel()).querySelector('section > div')!;
    const maps = grid.querySelectorAll('carlab-map');
    const box = maps[0]!.parentElement!;

    expect(maps).toHaveLength(1);
    expect(box.parentElement).toBe(grid);
    expect(box.classList.contains('lg:col-span-2')).toBe(true);
    expect(
      grid.querySelector(':scope > picture ~ div carlab-map'),
    ).not.toBeNull();
    expect(maps[0]!.getAttribute('data-title')).toBe(
      content('ru').pages.contact.mapHeading,
    );
  });

  it('leads with the photo on a phone unless the page puts it after the address', async () => {
    const picture = async (props = {}) =>
      (await panel(props)).querySelector('picture')!.classList;

    expect((await picture()).contains('max-lg:order-first')).toBe(true);
    expect(
      (await picture({ mediaFirst: false })).contains('max-lg:order-first'),
    ).toBe(false);
  });

  it('shows the Google rating under the address', async () => {
    expect((await panel()).textContent).toContain('5.0 в Google · 22 отзыва');
  });

  it('renders the channels slot inside the panel', async () => {
    const root = await panel({}, { channels: '<ul id="channels"></ul>' });

    expect(root.querySelector('section #channels')).not.toBeNull();
  });
});
