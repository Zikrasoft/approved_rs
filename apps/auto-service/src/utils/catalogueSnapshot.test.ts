import { describe, expect, it, vi } from 'vitest';
import type {
  Category,
  Fitment,
  PartPage,
  Vehicle,
} from '@podbor/catalog-contract';
import {
  assembleSnapshot,
  cataloguePagesFrom,
  makeHubsFrom,
  type MakeHubEntry,
} from './catalogueSnapshot';

const MAKES = ['bmw', 'audi', 'mini', 'lada', 'opel', 'fiat', 'skoda', 'kia'];
const CATEGORY_COUNT = 40;

const random = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

function syntheticCatalogue(
  partCount: number,
  {
    vehicleCount = Math.max(12, Math.round(partCount * 0.7)),
    fitsPerPart = 20,
  } = {},
) {
  const next = random(partCount);
  const categories = Array.from(
    { length: CATEGORY_COUNT },
    (_, index) =>
      ({
        id: `category_${index}`,
        slug: `category-${index}`,
        name: `Category ${index}`,
        text: '',
        translations: null,
        maintenance_kit: index < 3,
        kit_rank: index,
        service_label: null,
        service_price: null,
        service_note: null,
        image: null,
        fields: [],
      }) as unknown as Category,
  );
  const vehicles = Array.from({ length: vehicleCount }, (_, index) => {
    const modelIndex = Math.floor(index / 2);
    const make = MAKES[modelIndex % MAKES.length];
    return {
      id: `veh_${index}`,
      slug: `veh-${index}`,
      power_kw: 100,
      drive: 'fwd',
      market: 'EU',
      year_from: 2010,
      year_to: 2015,
      steering: index % 5 === 0 ? 'right' : 'left',
      model: {
        slug: modelIndex % 10 === 9 ? 'model-shared' : `model-${modelIndex}`,
        name: `Model ${modelIndex}`,
        chassis: {
          code: `C${modelIndex}`,
          body_style: 'sedan',
          series: {
            name: `Series ${modelIndex}`,
            translations: null,
            make: { slug: make, name: make.toUpperCase() },
          },
        },
      },
      engine: {
        code: 'E1',
        family: 'E',
        fuel: 'petrol',
        displacement_cc: 1600,
      },
      identifiers: [],
      requirements:
        index % 7 === 3
          ? [
              {
                id: `requirement_${index}`,
                category_id: categories[index % 3].id,
                field_key: 'approvals',
                option_keys: [`spec-${index % 4}`],
                min: null,
                max: null,
                quantity: 1 + (index % 4),
              },
            ]
          : [],
    } as unknown as Vehicle;
  });
  const pages: PartPage[] = [];
  const fitments: Fitment[] = [];
  for (let index = 0; index < partCount; index += 1) {
    const partId = `part_${index}`;
    const part = {
      id: partId,
      name: `Part ${index}`,
      translations: null,
      replaced_by: index % 17 === 5 ? { id: `part_${index + 1}` } : null,
      category_id:
        index % 29 === 0
          ? null
          : categories[Math.floor(next() * CATEGORY_COUNT)].id,
      attributes: { approvals: [`spec-${index % 4}`] },
      description: null,
    };
    const page = (brand: string, number: string) =>
      ({
        id: `pi_${brand}_${index}`,
        type: 'manufacturer-number',
        value: number,
        normalized_value: number,
        superseded: false,
        brand: { name: brand, slug: brand },
        images: [],
        part,
        equivalents: [],
        offers: [],
        supplier_data: { cross_references: [], applicability: [], images: [] },
      }) as unknown as PartPage;
    pages.push(page('mann-filter', `HU${index}`));
    if (index % 7 === 0) {
      pages.push(page('bosch', `F${index}`));
    }
    const start = Math.floor(next() * vehicleCount);
    for (let offset = 0; offset < fitsPerPart; offset += 1) {
      const vehicle = (start + offset * (1 + (index % 3))) % vehicleCount;
      fitments.push({
        id: `fit_${index}_${offset}`,
        part_id: partId,
        vehicle_id: `veh_${vehicle}`,
        quantity: 1,
        axle: offset % 4 === 0 ? 'front' : null,
        side: null,
        production_from: null,
        production_to: null,
        gearbox: null,
        steering: offset % 9 === 0 ? 'left' : null,
        note: null,
        translations: null,
      } as unknown as Fitment);
    }
  }
  return assembleSnapshot(pages, categories, fitments, vehicles);
}

const outline = (hubs: MakeHubEntry[]) =>
  hubs.map(({ make, parts, models }) => [
    make.slug,
    parts,
    models.map(({ model, vehicles, categories }) => [
      model.slug,
      vehicles.map(({ id }) => id).join(' '),
      categories.map(({ category, parts: modelParts }) => [
        category.slug,
        modelParts
          .map(
            ({ part, pages, fits }) =>
              `${part.id}:${pages.map(({ slug }) => slug).join('+')}:${fits
                .map(({ id }) => id)
                .join('+')}`,
          )
          .join(' '),
      ]),
    ]),
  ]);

describe('makeHubsFrom', () => {
  it('assembles the same hubs for a mixed catalogue', () => {
    expect(outline(makeHubsFrom(syntheticCatalogue(120)))).toMatchSnapshot();
  });

  it('assembles the hubs once per snapshot across module instances, as the config and the pages load apart', async () => {
    const snapshot = syntheticCatalogue(30);
    const hubs = makeHubsFrom(snapshot);
    vi.resetModules();
    const reloaded = await import('./catalogueSnapshot');

    expect(reloaded.makeHubsFrom).not.toBe(makeHubsFrom);
    expect(reloaded.makeHubsFrom(snapshot)).toBe(hubs);
    expect(reloaded.cataloguePagesFrom(snapshot)).toBe(
      cataloguePagesFrom(snapshot),
    );
  });

  it('assembles the hubs of a 30,000-part catalogue in linear time', () => {
    const snapshot = syntheticCatalogue(30_000, {
      vehicleCount: 40_000,
      fitsPerPart: 30,
    });
    const started = performance.now();
    const hubs = makeHubsFrom(snapshot);
    const seconds = (performance.now() - started) / 1000;

    expect(hubs.length).toBeGreaterThan(0);
    expect(seconds).toBeLessThan(20);
  }, 120_000);
});
