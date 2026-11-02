import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import ContactPage from './contact.astro';

const { pages, site } = content('ru');
const page = () =>
  render(ContactPage as never, {
    path: '/ru/contact/',
    params: { locale: 'ru' },
  });

describe('the contacts page', () => {
  it('opens on the visit panel: name, address, hours, call and route', async () => {
    const root = await page();
    const panel = root.querySelector('[data-contact-placement="visit"]')!;

    expect(panel.querySelector('h1')?.textContent?.trim()).toBe(
      pages.contact.heading,
    );
    expect(panel.textContent).toContain('Jovana Ćirilova 23a');
    expect(panel.textContent).toContain(site.hours.week);
    expect(panel.querySelector('a[href^="tel:"]')).not.toBeNull();
    expect(
      panel.querySelector('a[href^="https://www.google.com/maps/dir/"]'),
    ).not.toBeNull();
  });

  it('offers the three messengers inside the panel, once', async () => {
    const root = await page();
    const panel = root.querySelector('[data-contact-placement="visit"]')!;
    const tiles = [
      ...panel.querySelectorAll<HTMLElement>('[data-contact-channel]'),
    ].filter((tile) => tile.dataset.contactChannel !== 'phone');

    expect(tiles.map((tile) => tile.dataset.contactChannel)).toEqual([
      'telegram',
      'whatsapp',
      'viber',
    ]);
  });

  it('puts the map in the panel over a link that works without it', async () => {
    const map = (await page()).querySelector(
      '[data-contact-placement="visit"] carlab-map',
    )!;

    expect(map.parentElement?.querySelector('a')?.textContent).toContain(
      pages.contact.openMap,
    );
  });

  it('then tells how to get here and what to bring, then the form', async () => {
    const root = await page();
    const headings = [...root.querySelectorAll('h2')].map((h) =>
      h.textContent?.trim(),
    );

    expect(headings).toEqual(
      expect.arrayContaining([
        pages.contact.mapHeading,
        pages.contact.arrivalHeading,
        site.form.heading,
      ]),
    );
    expect(
      root.querySelector('#lead [data-lead-form], #lead form'),
    ).not.toBeNull();
    expect(root.textContent).not.toContain('пятнадцать');
  });

  it('shows the street entrance above the map, so a visitor knows the place on arrival', async () => {
    const panel = (await page()).querySelector(
      '[data-contact-placement="visit"]',
    )!;
    const image = panel.querySelector('img')!;

    expect(image.getAttribute('src')).toContain('workshop-facade');
    expect(image.getAttribute('alt')).toBe(site.photos.facade);
    expect(
      image.parentElement?.querySelector('img ~ * carlab-map'),
    ).not.toBeNull();
  });
});
