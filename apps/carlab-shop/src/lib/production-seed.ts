import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { MedusaContainer } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { seedCashAtPickupCommerceDefaults } from './commerce-defaults';
import { storeImage } from './images';

export const CATEGORIES = [
  {
    slug: 'maintenance-consumables',
    name: 'ТО и расходники',
    text: 'Все для планового ТО, от фильтров до технических жидкостей. Подбираем точно под ваш VIN, в том числе для BMW, Mercedes-Benz и других европейских марок.',
  },
  {
    slug: 'brakes',
    name: 'Тормозная система',
    text: 'Колодки, диски и все, что с ними связано. Подбираем точно под модель и год выпуска.',
  },
  {
    slug: 'suspension',
    name: 'Подвеска и рулевое',
    text: 'От стука в подвеске до замены рулевых наконечников. Подберем деталь под ваш автомобиль.',
  },
  {
    slug: 'engine-parts',
    name: 'Двигатель',
    text: 'Запчасти для ремонта и обслуживания двигателя, от прокладок до турбины.',
  },
  {
    slug: 'electrics',
    name: 'Электрика',
    text: 'Электрика автомобиля, от аккумулятора до датчиков. Подберем деталь, которая точно подойдет.',
  },
  {
    slug: 'transmission',
    name: 'Трансмиссия и приводы',
    text: 'Детали трансмиссии и приводов, от сцепления до подшипников ступиц.',
  },
  {
    slug: 'body-parts',
    name: 'Кузовные детали',
    text: 'Кузовные детали после ДТП или просто на замену. Подберем по VIN, чтобы точно подошло.',
  },
];

const IMAGES = join(process.cwd(), 'assets/categories');
const imageFile = (slug: string) =>
  slug === 'body-parts' ? `${slug}.png` : `${slug}.jpg`;

export async function seedProductionCatalogue(
  container: MedusaContainer,
): Promise<void> {
  await seedCashAtPickupCommerceDefaults(container);

  const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
  const existing = await catalog.listCategories(
    { slug: CATEGORIES.map(({ slug }) => slug) },
    { take: null },
  );
  for (const category of CATEGORIES) {
    const row =
      existing.find(({ slug }) => slug === category.slug) ??
      (await catalog.createCategories(category));
    if (row.updated_by) continue;
    if (row.image && row.name === category.name && row.text === category.text) {
      continue;
    }
    const image =
      row.image ??
      (await storeImage(
        container,
        readFileSync(join(IMAGES, imageFile(category.slug))),
        `categories/${row.id}`,
        null,
      ));
    await catalog.updateCategories({
      id: row.id,
      name: category.name,
      text: category.text,
      image,
    });
  }
}
