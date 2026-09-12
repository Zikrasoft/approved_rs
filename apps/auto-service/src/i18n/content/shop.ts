import shopYaml from '@/content/i18n/shop.yaml?raw';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { shopContentSchema } from './shopContentSchema';

export type { ShopContent } from './shopContentSchema';

export const getShopContent = loadI18nSection(shopContentSchema, shopYaml);
