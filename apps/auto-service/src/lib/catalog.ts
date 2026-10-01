import { z } from 'zod';
import { parseAttributes } from '@podbor/shop-catalog';
import {
  MEDUSA_LOCALE,
  PUBLISHABLE_KEY_HEADER,
  SERVICE_TYPE,
  SHOP_CURRENCY,
  type FitmentEntry,
  type Spec,
} from '@podbor/shop-catalog/browser';
import type { Locale } from '@/i18n/config';

export const CATALOG_LIMIT = 1000;

export const PRODUCT_FIELDS = [
  'id',
  'handle',
  'title',
  'description',
  'thumbnail',
  'metadata',
  'type.value',
  '*images',
  'variants.id',
  'variants.sku',
  'variants.calculated_price',
  'variants.manage_inventory',
  'variants.allow_backorder',
  '+variants.inventory_quantity',
].join(',');

export interface StoreEnv {
  backendUrl: string;
  publishableKey: string;
}

export interface CatalogProduct {
  id: string;
  handle: string;
  typeKey: string;
  title: string;
  description: string | null;
  image: string | null;
  spec: Spec;
  fitment: FitmentEntry[];
  variantId: string;
  price: number;
  inStock: boolean;
}

export interface Installation {
  handle: string;
  variantId: string;
  price: number;
}

export interface Catalog {
  products: CatalogProduct[];
  installations: Record<string, Installation>;
}

const envSchema = z.object({
  PUBLIC_MEDUSA_BACKEND_URL: z.url({ protocol: /^https?$/ }),
  PUBLIC_MEDUSA_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
});

export function readStoreEnv(env: Record<string, unknown>): StoreEnv {
  const parsed = envSchema.parse(env);
  return {
    backendUrl: parsed.PUBLIC_MEDUSA_BACKEND_URL,
    publishableKey: parsed.PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  };
}

const variantSchema = z.object({
  id: z.string(),
  sku: z.string().nullish(),
  manage_inventory: z.boolean(),
  allow_backorder: z.boolean().nullish(),
  inventory_quantity: z.number().nullish(),
  calculated_price: z
    .object({
      calculated_amount: z.number().nullish(),
      currency_code: z.string().nullish(),
    })
    .nullish(),
});

const productSchema = z.object({
  id: z.string(),
  handle: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  thumbnail: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  type: z.object({ value: z.string() }).nullish(),
  images: z.array(z.object({ url: z.string() })).nullish(),
  variants: z.array(variantSchema),
});

const productsSchema = z.object({
  products: z.array(productSchema),
  count: z.number().int().nonnegative(),
});

const regionsSchema = z.object({
  regions: z.array(z.object({ id: z.string(), currency_code: z.string() })),
});

const versionSchema = z.object({ version: z.string().min(1) });

type StoreProduct = z.infer<typeof productSchema>;
type StoreVariant = z.infer<typeof variantSchema>;

function pickVariant(product: StoreProduct): StoreVariant | undefined {
  const sku = product.handle.toUpperCase();
  return (
    product.variants.find((variant) => variant.sku === sku) ??
    (product.variants.length === 1 ? product.variants[0] : undefined)
  );
}

function priceOf(variant: StoreVariant): number | undefined {
  const amount = variant.calculated_price?.calculated_amount;
  return variant.calculated_price?.currency_code === SHOP_CURRENCY &&
    typeof amount === 'number' &&
    amount > 0
    ? amount
    : undefined;
}

function buildCatalog(parsed: z.infer<typeof productsSchema>): {
  catalog: Catalog;
  skipped: string[];
} {
  const { products } = parsed;
  const skipped: string[] = [];
  const cards: CatalogProduct[] = [];
  const installations: Record<string, Installation> = {};

  for (const product of products) {
    const variant = pickVariant(product);
    if (!variant) {
      skipped.push(
        `${product.handle}: no variant with SKU ${product.handle.toUpperCase()}`,
      );
      continue;
    }
    const price = priceOf(variant);
    if (price === undefined) {
      skipped.push(`${product.handle}: no RSD price`);
      continue;
    }
    const typeKey = product.type?.value;
    if (typeKey === SERVICE_TYPE) {
      installations[product.handle] = {
        handle: product.handle,
        variantId: variant.id,
        price,
      };
      continue;
    }
    const attributes = parseAttributes(typeKey, product.metadata);
    if (!attributes.ok) {
      throw new Error(`[catalog] ${product.handle}: ${attributes.error}`);
    }
    cards.push({
      id: product.id,
      handle: product.handle,
      typeKey: attributes.type.key,
      title: product.title,
      description: product.description ?? null,
      image: product.thumbnail ?? product.images?.[0]?.url ?? null,
      spec: attributes.spec,
      fitment: attributes.fitment,
      variantId: variant.id,
      price,
      inStock:
        !variant.manage_inventory ||
        variant.allow_backorder === true ||
        (variant.inventory_quantity ?? 0) > 0,
    });
  }

  cards.sort((a, b) => a.price - b.price);
  return { catalog: { products: cards, installations }, skipped };
}

export function readCatalog(raw: unknown): {
  catalog: Catalog;
  skipped: string[];
} {
  return buildCatalog(productsSchema.parse(raw));
}

export function createCatalogLoader(
  env: StoreEnv,
  fetcher: typeof fetch = fetch,
) {
  const get = async <T>(
    path: string,
    schema: z.ZodType<T>,
    params: Record<string, string> = {},
  ): Promise<T> => {
    const url = new URL(path, env.backendUrl);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    const response = await fetcher(url, {
      headers: { [PUBLISHABLE_KEY_HEADER]: env.publishableKey },
    });
    if (!response.ok) {
      throw new Error(`Medusa answered ${response.status} for ${path}`);
    }
    try {
      return schema.parse(await response.json());
    } catch (cause) {
      throw new Error(`[catalog] bad answer from ${path}`, { cause });
    }
  };

  let version: Promise<string> | undefined;
  let region: Promise<string> | undefined;
  const catalogs = new Map<Locale, Promise<Catalog>>();

  const loader = {
    version: () =>
      (version ??= get('/store/catalog-version', versionSchema).then(
        (body) => body.version,
      )),

    regionId: () =>
      (region ??= get('/store/regions', regionsSchema).then(({ regions }) => {
        const rsd = regions.find(
          (candidate) => candidate.currency_code === SHOP_CURRENCY,
        );
        if (!rsd) throw new Error('[catalog] Medusa has no RSD region');
        return rsd.id;
      })),

    catalog(locale: Locale): Promise<Catalog> {
      const cached = catalogs.get(locale);
      if (cached) return cached;
      const loading = (async () => {
        await loader.version();
        const raw = await get('/store/products', productsSchema, {
          region_id: await loader.regionId(),
          locale: MEDUSA_LOCALE[locale],
          limit: String(CATALOG_LIMIT),
          fields: PRODUCT_FIELDS,
        });
        if (raw.count > CATALOG_LIMIT || raw.products.length !== raw.count) {
          throw new Error(
            raw.count > CATALOG_LIMIT
              ? `[catalog] Medusa holds ${raw.count} products, one read returns ${CATALOG_LIMIT} — add pagination`
              : `[catalog] Medusa reported ${raw.count} products but returned ${raw.products.length}`,
          );
        }
        const { catalog, skipped } = buildCatalog(raw);
        for (const reason of skipped)
          console.warn(`[catalog] skipped ${reason}`);
        if (catalog.products.length === 0) {
          throw new Error('[catalog] the catalog is empty');
        }
        return catalog;
      })();
      catalogs.set(locale, loading);
      return loading;
    },
  };
  return loader;
}

let defaultLoader: ReturnType<typeof createCatalogLoader> | undefined;

export const shopCatalog = () =>
  (defaultLoader ??= createCatalogLoader(readStoreEnv(import.meta.env)));
