import { z } from 'zod';
import { shopOpenSchema } from '@podbor/catalog-contract/preview';
import type { Category } from '@podbor/catalog-contract';
import { createCatalogue } from './catalogue';
import type {
  CarPageEntry,
  CategoryPageEntry,
  MakeHubEntry,
  PartPageEntry,
} from './catalogueSnapshot';

export type CatalogueEnv = {
  MEDUSA_BACKEND_URL?: string;
  MEDUSA_PUBLISHABLE_KEY?: string;
  SHOP_OPEN?: string;
};

const unsetWhenEmpty = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => value || undefined, schema.optional());

const catalogueEnvSchema = z
  .object({
    MEDUSA_BACKEND_URL: unsetWhenEmpty(z.url()),
    MEDUSA_PUBLISHABLE_KEY: unsetWhenEmpty(z.string()),
  })
  .transform(({ MEDUSA_BACKEND_URL, MEDUSA_PUBLISHABLE_KEY }, context) => {
    if (!MEDUSA_BACKEND_URL) {
      return null;
    }
    if (!MEDUSA_PUBLISHABLE_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['MEDUSA_PUBLISHABLE_KEY'],
        message: 'MEDUSA_PUBLISHABLE_KEY is required with MEDUSA_BACKEND_URL',
      });
      return z.NEVER;
    }
    return {
      backendUrl: MEDUSA_BACKEND_URL,
      publishableKey: MEDUSA_PUBLISHABLE_KEY,
    };
  });

export const shopOpen = (env: CatalogueEnv = siteEnv()): boolean =>
  shopOpenSchema.parse(env.SHOP_OPEN) ?? false;

export function catalogueFromEnv(
  env: CatalogueEnv,
  { preview = false }: { preview?: boolean } = {},
) {
  const config = catalogueEnvSchema.parse(env);
  return config
    ? createCatalogue({ ...config, shopOpen: shopOpen(env), preview })
    : null;
}

export const siteEnv = (): CatalogueEnv => ({
  MEDUSA_BACKEND_URL: import.meta.env.MEDUSA_BACKEND_URL,
  MEDUSA_PUBLISHABLE_KEY: import.meta.env.MEDUSA_PUBLISHABLE_KEY,
  SHOP_OPEN: import.meta.env.SHOP_OPEN,
});

export async function partPagesForBuild(
  env = siteEnv(),
): Promise<PartPageEntry[]> {
  return (await catalogueFromEnv(env)?.partPages()) ?? [];
}

export async function categoriesForBuild(env = siteEnv()): Promise<Category[]> {
  return (await catalogueFromEnv(env)?.categories()) ?? [];
}

export async function categoryPagesForBuild(
  env = siteEnv(),
): Promise<CategoryPageEntry[]> {
  return (await catalogueFromEnv(env)?.categoryPages()) ?? [];
}

export async function carPagesForBuild(
  env = siteEnv(),
): Promise<CarPageEntry[]> {
  return (await catalogueFromEnv(env)?.carPages()) ?? [];
}

export async function makeHubsForBuild(
  env = siteEnv(),
): Promise<MakeHubEntry[]> {
  return (await catalogueFromEnv(env)?.makeHubs()) ?? [];
}
