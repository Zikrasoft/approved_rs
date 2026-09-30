import { storeJson } from './store';

export const STOCK_EVENT = 'carlab:stock';

export interface StockDetail {
  variantId: string;
  quantity: number | null;
}

interface StockVariant {
  id: string;
  manage_inventory?: boolean | null;
  allow_backorder?: boolean | null;
  inventory_quantity?: number | null;
}

const FIELDS =
  'handle,variants.id,variants.manage_inventory,variants.allow_backorder,+variants.inventory_quantity';

export async function fetchStock(
  handle: string,
  variantId: string,
): Promise<number | null> {
  const { products } = await storeJson<{
    products: { handle: string; variants: StockVariant[] }[];
  }>('/store/products', { params: { handle, fields: FIELDS } });
  const variant = products
    .find((product) => product.handle === handle)
    ?.variants.find((candidate) => candidate.id === variantId);
  if (!variant)
    throw new Error(`Medusa has no variant ${variantId} of ${handle}`);
  if (!variant.manage_inventory || variant.allow_backorder) return null;
  return variant.inventory_quantity ?? 0;
}
