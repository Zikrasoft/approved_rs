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
