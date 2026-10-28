import { z } from 'zod';
import { shopOpenSchema } from '@podbor/catalog-contract/preview';
import type { CatalogueRedirect, Category } from '@podbor/catalog-contract';
import { CARLAB } from '@podbor/brands';
import { CATALOGUE_TIMEOUT_MS, createCatalogue } from './catalogue';
import {
  categoryPagesFrom,
  makeHubsFrom,
  type CarPageEntry,
  type CategoryPageEntry,
  type MakeHubEntry,
  type PartPageEntry,
} from './catalogueSnapshot';

const catalogueEnvKeys = [
  'MEDUSA_BACKEND_URL',
  'MEDUSA_PUBLISHABLE_KEY',
  'SHOP_OPEN',
  'VERCEL',
  'CATALOGUE_SHRINK_ALLOWED',
] as const;

export type CatalogueEnv = Partial<
  Record<(typeof catalogueEnvKeys)[number], string>
>;

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
  VERCEL: import.meta.env.VERCEL,
  CATALOGUE_SHRINK_ALLOWED: import.meta.env.CATALOGUE_SHRINK_ALLOWED,
});

export const PREVIOUS_BUILD_URL = `${CARLAB.url}/catalogue-build.json`;

const SHRINK_FLOOR = 0.5;

const previousBuildSchema = z.object({
  partPages: z.number().int().nonnegative(),
});

async function livePartPages(): Promise<number> {
  const response = await fetch(PREVIOUS_BUILD_URL, {
    signal: AbortSignal.timeout(CATALOGUE_TIMEOUT_MS),
  });
  if (response.status === 404) {
    return 0;
  }
  if (!response.ok) {
    throw new Error(`${PREVIOUS_BUILD_URL} answered ${response.status}`);
  }
  return previousBuildSchema.parse(await response.json()).partPages;
}

async function loadSnapshot(env: CatalogueEnv) {
  const live = env.VERCEL === '1' ? await livePartPages() : 0;
  const catalogue = catalogueFromEnv(env);
  if (!catalogue) {
    if (live > 0) {
      throw new Error(
        `MEDUSA_BACKEND_URL is not set, but ${CARLAB.url} serves ${live} part pages`,
      );
    }
    return null;
  }
  const snapshot = await catalogue.snapshot();
  const built = snapshot.entries.length;
  const shrinkAllowed = env.CATALOGUE_SHRINK_ALLOWED === 'true';
  const shrunk = !shrinkAllowed && built < live * SHRINK_FLOOR;
  if (live > 0 && (built === 0 || shrunk)) {
    throw new Error(
      `The shop gives ${built} part pages, but ${CARLAB.url} serves ${live}; set CATALOGUE_SHRINK_ALLOWED=true for one build if that is intended`,
    );
  }
  return snapshot;
}

const BUILD_SNAPSHOTS = Symbol.for('carlab.buildSnapshots');

type SnapshotMemo = Map<string, ReturnType<typeof loadSnapshot>>;

function snapshotForBuild(env: CatalogueEnv) {
  if (import.meta.env?.MODE === 'development') {
    return loadSnapshot(env);
  }
  const holder = globalThis as { [BUILD_SNAPSHOTS]?: SnapshotMemo };
  const memo = (holder[BUILD_SNAPSHOTS] ??= new Map());
  const key = JSON.stringify(catalogueEnvKeys.map((name) => env[name]));
  const cached = memo.get(key);
  if (cached) {
    return cached;
  }
  const loading = loadSnapshot(env).catch((error: unknown) => {
    memo.delete(key);
    throw error;
  });
  memo.set(key, loading);
  return loading;
}

export async function partPagesForBuild(
  env = siteEnv(),
): Promise<PartPageEntry[]> {
  return (await snapshotForBuild(env))?.entries ?? [];
}

export async function categoriesForBuild(env = siteEnv()): Promise<Category[]> {
  return (await snapshotForBuild(env))?.categories ?? [];
}

export async function categoryPagesForBuild(
  env = siteEnv(),
): Promise<CategoryPageEntry[]> {
  const snapshot = await snapshotForBuild(env);
  return snapshot ? categoryPagesFrom(snapshot) : [];
}

export async function carPagesForBuild(
  env = siteEnv(),
): Promise<CarPageEntry[]> {
  return (await snapshotForBuild(env))?.cars ?? [];
}

export async function makeHubsForBuild(
  env = siteEnv(),
): Promise<MakeHubEntry[]> {
  const snapshot = await snapshotForBuild(env);
  return snapshot ? makeHubsFrom(snapshot) : [];
}

export async function redirectsForBuild(
  env = siteEnv(),
): Promise<CatalogueRedirect[]> {
  return (await snapshotForBuild(env))?.redirects ?? [];
}
