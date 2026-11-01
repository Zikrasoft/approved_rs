import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category, Vehicle } from '@podbor/catalog-contract';
import { BCP47_BY_LOCALE } from '@/i18n/config';
import { content } from '@/i18n/content';
import { offer, partPage, render, setShop } from '@/components/renderAstro';
import { PARTS_INQUIRY_OPEN_ATTRIBUTE } from '@/scripts/partsList';
import { formatMoney } from '@/utils/money';
import type { PartPageEntry } from '@/utils/catalogueSnapshot';
import VehiclePage from './[vehicle].astro';

const copy = content('ru').partsCar.car;

const vehicle = {
  id: 'veh_1',
  slug: 'b47d20o0-140kw',
  power_kw: 140,
  drive: 'rwd',
  market: 'EU',
  year_from: 2015,
  year_to: 2019,
  steering: 'left',
  model: {
    slug: 'f30-320d',
    name: '320d',
    chassis: {
      code: 'F30',
      body_style: 'sedan',
      series: {
        name: '3 серия',
        translations: null,
        make: { slug: 'bmw', name: 'BMW' },
      },
    },
  },
  engine: {
    code: 'B47D20O0',
    family: 'B47',
    fuel: 'diesel',
    displacement_cc: 1995,
  },
  identifiers: [],
  requirements: [],
} as unknown as Vehicle;

const oilFilters = {
  id: 'category_oil',
  slug: 'oil-filters',
  name: 'Масляные фильтры',
  text: 'Фильтр.',
  translations: null,
  maintenance_kit: true,
  kit_rank: 1,
  service_label: null,
  service_price: null,
  service_note: null,
  installation_price: null,
  image: null,
  fields: [],
} as unknown as Category;

const carPage = (pages: PartPageEntry[]) =>
  render(VehiclePage, {
    path: '/ru/parts/bmw/f30-320d/m/b47d20o0-140kw/',
    params: {
      locale: 'ru',
      make: 'bmw',
      model: 'f30-320d',
      vehicle: 'b47d20o0-140kw',
    },
    props: {
      car: {
        vehicle,
        groups: [],
        matches: [],
        kit: [
          {
            category: oilFilters,
            quantity: 1,
            part: pages[0].part,
            pages,
          },
        ],
      },
      places: {
        makes: new Set<string>(),
        models: new Set<string>(),
        categories: new Set<string>(),
        vehicles: new Set<string>(),
      },
    },
  });

const kitButton = (root: Element) =>
  root.querySelector('[data-add-all]') as Element;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the car page kit block', () => {
  it('asks for an inquiry with no prices while the shop is closed', async () => {
    setShop(false);
    const root = await carPage([partPage()]);

    expect(kitButton(root).textContent?.trim()).toBe(copy.kitAddClosed);
    expect(kitButton(root).hasAttribute(PARTS_INQUIRY_OPEN_ATTRIBUTE)).toBe(
      true,
    );
    expect(root.querySelector('parts-list-add-all')?.textContent).toContain(
      copy.kitNoteClosed,
    );
    expect(root.querySelector('kit-cart')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('parts-list-add-all')?.textContent).not.toContain(
      'RSD',
    );
  });

  it('adds the kit to the list and sells a fully priced kit once the shop is open', async () => {
    setShop(true);
    const root = await carPage([partPage({ offers: [offer(1200)] })]);

    expect(kitButton(root).textContent?.trim()).toBe(copy.kitAdd);
    expect(root.textContent).not.toContain(copy.kitNoteClosed);
    expect(root.querySelector('kit-cart')?.hasAttribute('data-buyable')).toBe(
      true,
    );
    expect(root.querySelector('[data-kit-total]')?.textContent).toContain(
      formatMoney(1200, 'RSD', BCP47_BY_LOCALE.ru),
    );
  });
});
