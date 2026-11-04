import { describe, expect, it } from 'vitest';
import Breadcrumbs from './Breadcrumbs.astro';
import { render } from './renderAstro';

const crumbs = (props: Record<string, unknown>) =>
  render(Breadcrumbs, { path: '/ru/services/servicing/', props });
const trail = [
  { href: '/ru/services/', label: 'Услуги' },
  { href: '/ru/services/servicing/', label: 'Плановое ТО' },
];

describe('Breadcrumbs', () => {
  it('starts the trail at home and marks the current page for the cart heading swap', async () => {
    const root = await crumbs({ crumbs: trail });
    const links = [...root.querySelectorAll('nav a')];

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/ru/',
      '/ru/services/',
      '/ru/services/servicing/',
    ]);
    expect(links.map((link) => link.hasAttribute('data-hero-crumb'))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('describes the same trail to search engines', async () => {
    const schema = JSON.parse(
      (await crumbs({ crumbs: trail })).querySelector(
        'script[type="application/ld+json"]',
      )!.textContent!,
    );

    expect(
      schema.itemListElement.map((item: { name: string }) => item.name),
    ).toEqual(['Главная', 'Услуги', 'Плановое ТО']);
  });

  it('hides a two-step trail on a phone, where it says nothing new', async () => {
    const nav = (root: Element) => root.querySelector('nav')!;

    expect(
      nav(await crumbs({ crumbs: trail.slice(0, 1) })).classList.contains(
        'max-sm:hidden',
      ),
    ).toBe(true);
    expect(
      nav(await crumbs({ crumbs: trail })).classList.contains('max-sm:hidden'),
    ).toBe(false);
  });

  it('reads light on the graphite panel and muted on paper', async () => {
    const list = async (tone?: string) =>
      (await crumbs({ crumbs: trail, tone })).querySelector('ol')!.classList;

    expect((await list()).contains('text-muted')).toBe(true);
    expect((await list('panel')).contains('text-panel-ink')).toBe(true);
  });
});
