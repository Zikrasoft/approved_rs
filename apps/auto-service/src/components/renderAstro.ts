import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';
import { CARLAB } from '@podbor/brands';
import type { PartPageEntry } from '@/utils/catalogueSnapshot';

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

export const respond = async (component: Component, request: Request) =>
  (await astro()).renderToResponse(component, { request });

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

export const partPage = (over: Partial<PartPageEntry> = {}): PartPageEntry => ({
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
  slug: 'bosch-0986494524',
  indexable: true,
  priceOnRequest: false,
  category: null,
  fits: [],
  requirementCars: [],
  kitCars: [],
  ...over,
});

const ORANGE = ['btn-primary', 'text-signal-ink', 'bg-signal-ink', 'bg-signal'];

export const isOrange = (element: Element) =>
  [...element.classList].some((name) => ORANGE.includes(name));

export const orangeIn = (root: Element) =>
  [...root.querySelectorAll('*')]
    .filter(isOrange)
    .map((element) => element.textContent?.replace(/\s+/g, ' ').trim());
