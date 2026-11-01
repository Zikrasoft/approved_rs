import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import VisitPanel from './VisitPanel.astro';
import { render } from './renderAstro';

const site = content('ru').site;
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

  it('splits into two columns only when it has a photo', async () => {
    const grid = (root: Element) => root.querySelector('section > div')!;
    const withPhoto = await panel({}, { media: '<img alt="" src="/bay.jpg">' });

    expect(grid(await panel()).classList.contains('lg:grid-cols-2')).toBe(
      false,
    );
    expect(grid(withPhoto).classList.contains('lg:grid-cols-2')).toBe(true);
    expect(withPhoto.querySelector('img')?.getAttribute('src')).toBe(
      '/bay.jpg',
    );
  });

  it('renders the channels slot inside the panel', async () => {
    const root = await panel({}, { channels: '<ul id="channels"></ul>' });

    expect(root.querySelector('section #channels')).not.toBeNull();
  });
});
