import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { MedusaContainer } from '@medusajs/framework/types';
import sharp from 'sharp';

import { imagesSchema, type StoredImage, storeImage } from '../lib/images';
import {
  DEMO_SUPPLIER_IMAGES,
  DEMO_SUPPLIERS,
  demoSupplierImage,
} from '../lib/suppliers/demo-adapter';
import type CatalogModuleService from '../modules/catalog/service';

const TEMPLATES = join(process.cwd(), 'src/scripts/demo-images');
const STATIC = join(process.cwd(), 'static');
const SEEDED_BY = 'seed-demo';

const PART_TEMPLATES: Record<string, string[][]> = {
  'oil-filters': [['oil-filter', 'oil-filter-top'], ['oil-filter']],
  'brake-pads': [['brake-pad', 'brake-pad-back'], ['brake-pad']],
  batteries: [['battery', 'battery-top'], ['battery']],
  'engine-oil': [['oil-can']],
  'body-parts': [['wiper']],
};

const CATEGORY_TEMPLATES: Record<string, string> = {
  'oil-filters': 'oil-filter',
  'brake-pads': 'brake-pad',
  batteries: 'battery',
  'engine-oil': 'oil-can',
  'maintenance-consumables': 'air-filter',
  brakes: 'brake-disc',
  suspension: 'shock',
  'engine-parts': 'spark-plug',
  electrics: 'sensor',
  transmission: 'gear',
  'body-parts': 'wiper',
};

const escapeXml = (text: string) =>
  text.replace(
    /[<>&"]/g,
    (char) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char]!,
  );

const render = (template: string, brand: string, label: string) =>
  sharp(
    Buffer.from(
      readFileSync(join(TEMPLATES, `${template}.svg`), 'utf8')
        .replaceAll('{{brand}}', escapeXml(brand))
        .replaceAll('{{label}}', escapeXml(label)),
    ),
  )
    .resize(1200)
    .png()
    .toBuffer();

export async function seedDemoImages(
  container: MedusaContainer,
  catalog: CatalogModuleService,
): Promise<void> {
  const categories = await catalog.listCategories({}, { take: null });
  for (const category of categories) {
    const template = CATEGORY_TEMPLATES[category.slug];
    if (category.image || !template) continue;
    const image = await storeImage(
      container,
      await render(template, '', ''),
      `categories/${category.id}`,
      SEEDED_BY,
    );
    await catalog.updateCategories({ id: category.id, image });
  }

  for (const category of categories) {
    const variants = PART_TEMPLATES[category.slug];
    if (!variants) continue;
    const parts = await catalog.listParts(
      { category_id: category.id },
      {
        relations: ['identifiers', 'identifiers.brand'],
        order: { name: 'ASC' },
        take: null,
      },
    );
    for (const [index, part] of parts.entries()) {
      if (index % 3 === 2) continue;
      const templates = variants[Math.min(index, variants.length - 1)];
      for (const number of part.identifiers) {
        if (imagesSchema.parse(number.images).items.length) continue;
        const items: StoredImage[] = [];
        for (const template of templates) {
          items.push(
            await storeImage(
              container,
              await render(template, number.brand.name, number.value),
              `part-identifiers/${number.id}`,
              SEEDED_BY,
            ),
          );
        }
        await catalog.updatePartIdentifiers({
          id: number.id,
          images: { items },
        });
      }
    }
  }

  for (const article of DEMO_SUPPLIERS.flatMap(({ articles }) => articles)) {
    const template = DEMO_SUPPLIER_IMAGES[article.article_id];
    if (!template) continue;
    const path = join(STATIC, demoSupplierImage(article.article_id));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      await sharp(await render(template, article.brand, article.number))
        .modulate({ saturation: 0.55, brightness: 0.97 })
        .resize(800)
        .webp({ quality: 78 })
        .toBuffer(),
    );
  }
}
