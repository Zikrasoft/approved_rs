import { translated } from '@podbor/catalog-contract';
import { addonDataset } from './categoryAddon';
import type { PartCard } from './partEntry';

export const partDataset = (page: PartCard, locale: string) => ({
  'data-slug': page.slug,
  'data-brand': page.brand.name,
  'data-number': page.value,
  'data-name': translated(page.part, 'name', locale),
  ...addonDataset(page.category),
});
