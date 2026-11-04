import { translated } from '@podbor/catalog-contract';
import { addonDataset } from './categoryAddon';
import type { PartPageEntry } from './catalogueSnapshot';

export const partDataset = (page: PartPageEntry, locale: string) => ({
  'data-slug': page.slug,
  'data-brand': page.brand.name,
  'data-number': page.value,
  'data-name': translated(page.part, 'name', locale),
  ...addonDataset(page.category),
});
