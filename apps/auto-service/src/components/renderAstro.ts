import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';
import { CARLAB } from '@podbor/brands';
import type { RelatedPartPage } from '@podbor/catalog-contract';
import type { PartCard } from '@/utils/partEntry';

type Component = Parameters<AstroContainer['renderToString']>[0];

type RenderOptions = { path?: string } & Parameters<
  AstroContainer['renderToString']
>[1];

let container: Promise<AstroContainer> | undefined;
const astro = () => (container ??= AstroContainer.create());

export const setShop = (open: boolean) =>
  vi.stubEnv('SHOP_OPEN', open ? 'true' : 'false');

export const parseHtml = (html: string) =>
  JSDOM.fragment(`<div>${html}</div>`).firstElementChild!;

export const respond = async (
  component: Component,
  request: Request,
  { params }: { params?: Record<string, string> } = {},
) => (await astro()).renderToResponse(component, { request, params });

export const SHOP_URL = 'http://shop.test';

export const SHOP_PREVIEW_TOKEN = 'preview-token-0123456789abcdef0123';

export const stubShop = (
  answer: (url: URL, headers: Headers) => Response | Promise<Response>,
) => {
  vi.stubEnv('MEDUSA_BACKEND_URL', SHOP_URL);
  vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', 'pk_test');
  vi.stubEnv('SHOP_PREVIEW_TOKEN', SHOP_PREVIEW_TOKEN);
  const fetch = vi.fn(
    async (input: string | URL | Request, init: RequestInit = {}) =>
      answer(new URL(String(input)), new Headers(init.headers)),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

export async function render(
  component: Component,
  { path = '/ru/parts/', ...options }: RenderOptions = {},
) {
  const html = await (
    await astro()
  ).renderToString(component, {
    request: new Request(new URL(path, CARLAB.url)),
    ...options,
  });
  return parseHtml(html);
}

export const offer = (price: number, stock = 3, lead = 0) => ({
  id: `offer_${price}_${stock}_${lead}`,
  price,
  currency: 'RSD',
  stock_quantity: stock,
  lead_time_days: lead,
});

export const wirePage = (
  over: Partial<RelatedPartPage> = {},
): RelatedPartPage => ({
  id: 'pi_bosch',
  type: 'manufacturer-number',
  value: '0 986 494 524',
  normalized_value: '0986494524',
  superseded: false,
  listed: null,
  brand: { name: 'Bosch', slug: 'bosch' },
  images: [],
  part: {
    id: 'part_pads',
    name: 'Тормозные колодки',
    description: null,
    translations: null,
    replaced_by: null,
    category_id: null,
    attributes: {},
    installation_price: null,
  },
  equivalents: [],
  offers: [],
  supplier_data: { cross_references: [], applicability: [], images: [] },
  demand: null,
  slug: 'bosch-0986494524',
  category: null,
  ...over,
});

export const partCard = (over: Partial<PartCard> = {}): PartCard => ({
  ...wirePage(),
  priceOnRequest: false,
  ...over,
});

const ORANGE = ['btn-primary', 'text-signal-ink', 'bg-signal-ink', 'bg-signal'];

export const isOrange = (element: Element) =>
  [...element.classList].some((name) => ORANGE.includes(name));

export const orangeIn = (root: Element) =>
  [...root.querySelectorAll('*')]
    .filter(isOrange)
    .map((element) => element.textContent?.replace(/\s+/g, ' ').trim());

export const heroPartsSearch = (root: Element) => {
  const block = root.querySelector('[data-hero-parts-search]');
  return block?.closest('section')?.querySelector('h1') ? block : null;
};

export const heroOrder = (root: Element) => {
  const hero = root.querySelector('section')!;
  return [
    hero.querySelector('a[href^="https://maps.google.com"]'),
    hero.querySelector('[data-contact-placement="hero"]'),
    hero.querySelector('[data-hero-parts-search]'),
  ].map((node) => [...hero.querySelectorAll('*')].indexOf(node!));
};
