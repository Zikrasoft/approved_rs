import { Modules } from '@medusajs/framework/utils';

import { SHOP } from '../../src/lib/shop';

export type StoreHeaders = { 'x-publishable-api-key': string };

type Container = { resolve(key: string): unknown };

type ApiKeyService = {
  listApiKeys(filter: {
    type: string;
  }): Promise<{ token: string; title: string }[]>;
};

export async function storeHeaders(
  getContainer: () => Container,
): Promise<StoreHeaders> {
  const keys = await (
    getContainer().resolve(Modules.API_KEY) as ApiKeyService
  ).listApiKeys({ type: 'publishable' });
  const key = keys.find((row) => row.title === SHOP.publishableKeyTitle);
  if (!key) {
    throw new Error('No carlab.rs publishable key — run seed-base first');
  }
  return { 'x-publishable-api-key': key.token };
}

let clients = 0;

export const anotherClient = () => ({
  'x-forwarded-for': `198.51.100.${(clients = (clients % 250) + 1)}`,
});

type Api = {
  get<T>(path: string, options: { headers: object }): Promise<{ data: T }>;
};

export async function rsdRegionId(
  api: Api,
  headers: StoreHeaders,
): Promise<string> {
  const { data } = await api.get<{
    regions: { id: string; currency_code: string }[];
  }>('/store/regions', { headers });
  const region = data.regions.find(
    (row) => row.currency_code === SHOP.currency,
  );
  if (!region) {
    throw new Error('No RSD region — run seed-base first');
  }
  return region.id;
}

export async function variantIdBySku(
  api: Api,
  headers: StoreHeaders,
  regionId: string,
  handle: string,
  sku: string,
): Promise<string> {
  const { data } = await api.get<{
    products: { variants: { id: string; sku: string }[] }[];
  }>(
    `/store/products?handle=${handle}&region_id=${regionId}&fields=*variants`,
    {
      headers,
    },
  );
  const variant = data.products[0]?.variants.find((row) => row.sku === sku);
  if (!variant) {
    throw new Error(`Seeded variant ${sku} is missing`);
  }
  return variant.id;
}

export async function pickupOptionId(
  getContainer: () => Container,
): Promise<string> {
  const query = getContainer().resolve('query') as {
    graph(
      input: object,
    ): Promise<{ data: { id: string; type?: { code?: string } | null }[] }>;
  };
  const { data } = await query.graph({
    entity: 'shipping_option',
    fields: ['id', 'type.code'],
  });
  const pickup = data.filter((row) => row.type?.code === SHOP.pickupCode);
  if (pickup.length !== 1) {
    throw new Error(`Expected one pickup option, found ${pickup.length}`);
  }
  return pickup[0].id;
}
