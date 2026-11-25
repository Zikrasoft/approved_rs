import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  shopOpenSchema,
  shopPreviewTokenSchema,
} from '@podbor/catalog-contract/preview';
import { requestIdSchema } from '@podbor/catalog-contract/events';
import { secretMatches } from '@podbor/lead-crm/verify-secret';
import {
  sortedMakes,
  type CataloguePageList,
  type Category,
} from '@podbor/catalog-contract';
import { CARLAB } from '@podbor/brands';
import { VISITOR_ID_COOKIE } from '@podbor/site-kit';
import { CATALOGUE_TIMEOUT_MS, createCatalogue } from './catalogue';
import { isBotAgent } from './botAgent';
import { PREVIEW_COOKIE } from './shopPreview';

const catalogueEnvKeys = [
  'MEDUSA_BACKEND_URL',
  'MEDUSA_PUBLISHABLE_KEY',
  'SHOP_OPEN',
  'SHOP_PREVIEW_TOKEN',
  'CATALOGUE_SHRINK_GUARD',
  'CATALOGUE_SHRINK_ALLOWED',
] as const;

export type CatalogueEnv = Partial<
  Record<(typeof catalogueEnvKeys)[number] | 'SHOP_CLIENT_SECRET', string>
>;

const unsetWhenEmpty = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => value || undefined, schema.optional());

const internalUrlSchema = unsetWhenEmpty(z.url()).catch(undefined);

export const shopBackendUrl = (
  buildUrl: string | undefined,
  internalUrl = process.env.SHOP_INTERNAL_URL,
): string | undefined => internalUrlSchema.parse(internalUrl) ?? buildUrl;

const catalogueEnvSchema = z
  .object({
    MEDUSA_BACKEND_URL: unsetWhenEmpty(z.url()),
    MEDUSA_PUBLISHABLE_KEY: unsetWhenEmpty(z.string()),
    SHOP_PREVIEW_TOKEN: unsetWhenEmpty(shopPreviewTokenSchema).catch(undefined),
    SHOP_CLIENT_SECRET: unsetWhenEmpty(z.string()),
  })
  .transform(
    (
      {
        MEDUSA_BACKEND_URL,
        MEDUSA_PUBLISHABLE_KEY,
        SHOP_PREVIEW_TOKEN,
        SHOP_CLIENT_SECRET,
      },
      context,
    ) => {
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
        previewToken: SHOP_PREVIEW_TOKEN,
        clientSecret: SHOP_CLIENT_SECRET,
      };
    },
  );

export const shopOpen = (env: CatalogueEnv = siteEnv()): boolean =>
  shopOpenSchema.parse(env.SHOP_OPEN) ?? false;

export const previewTokenMatches = (
  token: string,
  env: CatalogueEnv = siteEnv(),
): boolean =>
  secretMatches(
    token,
    shopPreviewTokenSchema.safeParse(env.SHOP_PREVIEW_TOKEN).data,
  );

const cookieOf = (request: Request, name: string): string =>
  new URLSearchParams(
    (request.headers.get('cookie') ?? '').replaceAll(/;\s*/g, '&'),
  ).get(name) ?? '';

export const previewRequested = (
  request: Request,
  env: CatalogueEnv = siteEnv(),
): boolean => previewTokenMatches(cookieOf(request, PREVIEW_COOKIE), env);

const visitorAddressSchema = z.union([z.ipv4(), z.ipv6()]);

export const visitorAddress = (request: Request): string | undefined =>
  visitorAddressSchema.safeParse(
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  ).data;

const visitorIdOf = (request: Request): string | undefined =>
  z.uuid().safeParse(cookieOf(request, VISITOR_ID_COOKIE)).data;

export const requestIdOf = (request: Request): string | undefined =>
  requestIdSchema.safeParse(request.headers.get('x-request-id')).data;

export function catalogueFromEnv(
  env: CatalogueEnv,
  {
    preview = false,
    visitor,
    timeoutMs,
  }: { preview?: boolean; visitor?: Request; timeoutMs?: number } = {},
) {
  const config = catalogueEnvSchema.parse(env);
  if (!config) return null;
  const { clientSecret, ...shop } = config;
  const address = visitor && visitorAddress(visitor);
  return createCatalogue({
    ...shop,
    shopOpen: shopOpen(env),
    preview,
    timeoutMs,
    requestId: visitor && requestIdOf(visitor),
    bot: visitor && isBotAgent(visitor.headers.get('user-agent')),
    visitorId: visitor && visitorIdOf(visitor),
    client:
      address && clientSecret ? { address, secret: clientSecret } : undefined,
  });
}

export const catalogueFor = (request: Request) => {
  const env = siteEnv();
  return catalogueFromEnv(
    { ...env, MEDUSA_BACKEND_URL: shopBackendUrl(env.MEDUSA_BACKEND_URL) },
    {
      preview: previewRequested(request),
      visitor: request,
    },
  );
};

export const uncachedJson = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store' },
  });

export const siteEnv = (): CatalogueEnv => ({
  MEDUSA_BACKEND_URL: import.meta.env.MEDUSA_BACKEND_URL,
  MEDUSA_PUBLISHABLE_KEY: import.meta.env.MEDUSA_PUBLISHABLE_KEY,
  SHOP_OPEN: import.meta.env.SHOP_OPEN,
  SHOP_PREVIEW_TOKEN: process.env.SHOP_PREVIEW_TOKEN,
  SHOP_CLIENT_SECRET: process.env.SHOP_CLIENT_SECRET,
  CATALOGUE_SHRINK_GUARD: import.meta.env.CATALOGUE_SHRINK_GUARD,
  CATALOGUE_SHRINK_ALLOWED: import.meta.env.CATALOGUE_SHRINK_ALLOWED,
});

export const PREVIOUS_BUILD_URL = `${CARLAB.url}/catalogue-build.json`;

const SHRINK_FLOOR = 0.5;

export const BUILD_CATALOGUE_TIMEOUT_MS = 30 * 60_000;

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

const refusedWithoutBackend = (live: number) => {
  if (live > 0) {
    throw new Error(
      `MEDUSA_BACKEND_URL is not set, but ${CARLAB.url} serves ${live} part pages`,
    );
  }
  return null;
};

const unreadable = (env: CatalogueEnv, error: unknown) =>
  new Error(
    `Could not read the catalogue from MEDUSA_BACKEND_URL (${env.MEDUSA_BACKEND_URL}): ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );

async function loadPageList(env: CatalogueEnv) {
  const live =
    env.CATALOGUE_SHRINK_GUARD === 'true' ? await livePartPages() : 0;
  const catalogue = catalogueFromEnv(env, {
    timeoutMs: BUILD_CATALOGUE_TIMEOUT_MS,
  });
  if (!catalogue) {
    return refusedWithoutBackend(live);
  }
  const list = await catalogue.pageList().catch((error: unknown) => {
    throw unreadable(env, error);
  });
  const built = list.parts.length;
  const shrinkAllowed = env.CATALOGUE_SHRINK_ALLOWED === 'true';
  const shrunk = !shrinkAllowed && built < live * SHRINK_FLOOR;
  if (live > 0 && (built === 0 || shrunk)) {
    throw new Error(
      `The shop gives ${built} part pages, but ${CARLAB.url} serves ${live}; set CATALOGUE_SHRINK_ALLOWED=true for one build if that is intended`,
    );
  }
  return list;
}

const BUILD_MEMO = Symbol.for('carlab.buildMemo');

export const DEV_BUILD_FRESH_MS = 30_000;

type BuildMemo = Map<string, { loading: Promise<unknown>; loadedAt?: number }>;

function memoizedForBuild<T>(
  name: string,
  load: (env: CatalogueEnv) => Promise<T>,
) {
  return (env: CatalogueEnv): Promise<T> => {
    const holder = globalThis as { [BUILD_MEMO]?: BuildMemo };
    const memo = (holder[BUILD_MEMO] ??= new Map());
    const key = JSON.stringify([
      name,
      ...catalogueEnvKeys.map((envKey) => env[envKey]),
    ]);
    const cached = memo.get(key);
    const stale =
      cached?.loadedAt !== undefined &&
      import.meta.env?.MODE === 'development' &&
      Date.now() - cached.loadedAt >= DEV_BUILD_FRESH_MS;
    if (cached && !stale) {
      return cached.loading as Promise<T>;
    }
    const loading: Promise<T> = load(env).then(
      (loaded) => {
        const entry = memo.get(key);
        if (entry?.loading === loading) {
          entry.loadedAt = Date.now();
        }
        return loaded;
      },
      (error: unknown) => {
        if (memo.get(key)?.loading === loading) {
          memo.delete(key);
        }
        throw error;
      },
    );
    memo.set(key, { loading });
    return loading;
  };
}

const pageListMemo = memoizedForBuild('pageList', loadPageList);

const EMPTY_PAGE_LIST: CataloguePageList = {
  parts: [],
  makes: [],
  series: [],
  categories: [],
  catalogue_makes: null,
};

export async function pageListForBuild(
  env = siteEnv(),
): Promise<CataloguePageList> {
  return (await pageListMemo(env)) ?? EMPTY_PAGE_LIST;
}

const categoriesMemo = memoizedForBuild('categories', async (env) => {
  const catalogue = catalogueFromEnv(env, {
    timeoutMs: BUILD_CATALOGUE_TIMEOUT_MS,
  });
  return catalogue
    ? catalogue.categories().catch((error: unknown) => {
        throw unreadable(env, error);
      })
    : [];
});

export async function categoriesForBuild(env = siteEnv()): Promise<Category[]> {
  return categoriesMemo(env);
}

export async function writeCatalogueMakes(
  file: URL,
  env = siteEnv(),
): Promise<void> {
  const makes = (await pageListForBuild(env)).catalogue_makes;
  if (makes) {
    await writeFile(file, `${JSON.stringify(sortedMakes(makes), null, 2)}\n`);
  }
}
