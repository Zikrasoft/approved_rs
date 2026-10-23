import { z } from 'zod';
import {
  CART_FINGERPRINT_FIELD,
  checkoutRefusalSchema,
  offerCartResponseSchema,
  partOffersResponseSchema,
  placedOrderResponseSchema,
  type CheckoutContact,
  type CheckoutRefusal,
  type OfferCart,
  type PartOffer,
  categoriesResponseSchema,
  describeFacet,
  enrichmentRule,
  fitmentsResponseSchema,
  maintenanceKit,
  partPageSlug,
  identifierOffersResponseSchema,
  partPagesResponseSchema,
  positionGroups,
  PRICE_FACET,
  rangeFilter,
  type RangeFilter,
  requirementMatches,
  searchResponseSchema,
  translated,
  universalFacets,
  usefulFacets,
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  type CatalogLocale,
  type Category,
  type Fitment,
  type PartPage,
  type PositionGroup,
  type SearchFacet,
  type SearchResponse,
  type SearchResult,
  type Vehicle,
  type VinFacts,
} from '@podbor/catalog-contract';
import { SHOP_PREVIEW_HEADER } from '../scripts/shopPreview';
import { partSuccessor } from './partSuccessor';

export type { Vehicle, VinFacts };

export const CATALOGUE_TIMEOUT_MS = 10_000;
export const MODEL_CATEGORY_MIN_MATCHES = 1;
const PAGE_BATCH = 1000;
const OFFERS_BATCH = 100;

export type Fit = Fitment & { vehicle: Vehicle };

export type PartPageEntry = PartPage & {
  slug: string;
  indexable: boolean;
  priceOnRequest: boolean;
  category: Category | null;
  fits: Fit[];
  requirementCars: Vehicle[];
  kitCars: Vehicle[];
};

export type SearchQuery = {
  q?: string;
  category?: string;
  model?: string;
  locale: CatalogLocale;
  facets: string[];
  ranges?: RangeFilter[];
  offset?: number;
};

export type SearchOutcome = Omit<SearchResponse, 'results'> & {
  results: (SearchResult & { slug: string })[];
};

export type CategoryPageEntry = Category & { pages: PartPageEntry[] };

export type CarPart = Fit & {
  category_id: string | null;
  part: PartPage['part'];
  pages: PartPageEntry[];
};

export type CarPartGroup = PositionGroup<CarPart> & {
  category: Category | null;
};

type Make = Vehicle['model']['chassis']['series']['make'];

export type ModelPart = {
  part: PartPage['part'];
  pages: PartPageEntry[];
  fits: Fit[];
};

export type CarMatch = {
  category: Category;
  quantity: number;
  parts: ModelPart[];
};

export type CarKitItem = {
  category: Category;
  quantity: number;
  part: PartPage['part'];
  pages: PartPageEntry[];
};

export type CarPageEntry = {
  vehicle: Vehicle;
  groups: CarPartGroup[];
  matches: CarMatch[];
  kit: CarKitItem[];
};

export type ModelCategoryEntry = { category: Category; parts: ModelPart[] };

export type ModelHubEntry = {
  make: Make;
  model: Vehicle['model'];
  vehicles: Vehicle[];
  categories: ModelCategoryEntry[];
};

export type MakeHubEntry = { make: Make; models: ModelHubEntry[] };

export type VinOutcome =
  | { kind: 'vehicle'; vehicle: Vehicle; facts: VinFacts }
  | { kind: 'inquiry'; vin: string };

export type OffersOutcome =
  { kind: 'offers'; offers: PartOffer[] } | { kind: 'inquiry' };

export type CartOutcome =
  | { kind: 'cart'; cart: OfferCart }
  | { kind: 'empty' }
  | { kind: 'refused'; code: CheckoutRefusal; cartId: string | null }
  | { kind: 'inquiry' };

export type OrderOutcome =
  | { kind: 'order'; order: { id: string; display_id: number } }
  | { kind: 'refused'; code: CheckoutRefusal }
  | { kind: 'empty' }
  | { kind: 'inquiry' };

export const catalogueIdSchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^[\w-]+$/);

export type CatalogueConfig = {
  backendUrl: string;
  publishableKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  shopOpen?: boolean;
  preview?: boolean;
};

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

const groupBy = <T>(items: T[], key: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  }
  return groups;
};

export function createCatalogue({
  backendUrl,
  publishableKey,
  fetch = globalThis.fetch,
  timeoutMs = CATALOGUE_TIMEOUT_MS,
  shopOpen = true,
  preview = false,
}: CatalogueConfig) {
  const pricesHidden = !shopOpen && !preview;
  const unpriced = <T extends { offers: PartOffer[] }>(item: T): T =>
    pricesHidden ? { ...item, offers: [] } : item;
  const send = (path: string, method = 'GET', body?: unknown) =>
    fetch(`${backendUrl}${path}`, {
      method,
      headers: {
        'x-publishable-api-key': publishableKey,
        ...((preview || shopOpen) && { [SHOP_PREVIEW_HEADER]: '1' }),
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });

  const request = async (path: string, body?: unknown): Promise<unknown> => {
    const response = await send(
      path,
      body === undefined ? 'GET' : 'POST',
      body,
    );
    if (!response.ok) {
      throw new Error(`Catalogue ${path} answered ${response.status}`);
    }
    return response.json();
  };

  const segment = encodeURIComponent;

  const cartOutcome = async (
    answer: Promise<Response>,
    cartId: string | null = null,
  ): Promise<CartOutcome> => {
    try {
      const response = await answer;
      if (response.status === 404) {
        return { kind: 'empty' };
      }
      if (!response.ok) {
        const refusal = checkoutRefusalSchema.safeParse(
          await response.json().catch(() => null),
        );
        return refusal.success
          ? { kind: 'refused', code: refusal.data.code, cartId }
          : { kind: 'inquiry' };
      }
      const { cart } = offerCartResponseSchema.parse(await response.json());
      return cart.completed || cart.items.length === 0
        ? { kind: 'empty' }
        : { kind: 'cart', cart };
    } catch {
      return { kind: 'inquiry' };
    }
  };

  const paged = async <T>(
    path: string,
    read: (body: unknown) => { items: T[]; count: number },
  ): Promise<T[]> => {
    const all: T[] = [];
    for (let offset = 0; ;) {
      const { items, count } = read(
        await request(`${path}?offset=${offset}&limit=${PAGE_BATCH}`),
      );
      all.push(...items);
      offset += items.length;
      if (items.length === 0 || offset >= count) {
        return all;
      }
    }
  };

  const categories = async (): Promise<Category[]> =>
    categoriesResponseSchema
      .parse(await request('/store/categories'))
      .categories.map((category) =>
        pricesHidden ? { ...category, service_price: null } : category,
      );

  const vehicles = async (): Promise<Vehicle[]> =>
    vehiclesResponseSchema.parse(await request('/store/vehicles')).vehicles;

  const snapshot = async () => {
    const [pages, allCategories, fitments, allVehicles] = await Promise.all([
      paged('/store/part-pages', (body) => {
        const { pages, count } = partPagesResponseSchema.parse(body);
        return { items: pages.map(unpriced), count };
      }),
      categories(),
      paged('/store/fitments', (body) => {
        const { fitments, count } = fitmentsResponseSchema.parse(body);
        return { items: fitments, count };
      }),
      vehicles(),
    ]);
    const categoryById = new Map(
      allCategories.map((category) => [category.id, category]),
    );
    const vehicleById = new Map(
      allVehicles.map((vehicle) => [vehicle.id, vehicle]),
    );
    const fits = fitments.flatMap((fitment) => {
      const vehicle = vehicleById.get(fitment.vehicle_id);
      return vehicle ? [{ ...fitment, vehicle }] : [];
    });
    const fitsByPart = groupBy(fits, ({ part_id }) => part_id);
    const gaps = enrichmentRule(allVehicles);
    const bySlug = new Map<string, PartPageEntry>();
    for (const page of pages) {
      const slug = partPageSlug(page.brand.slug, page.normalized_value);
      if (bySlug.has(slug)) {
        continue;
      }
      const category = categoryById.get(page.part.category_id ?? '') ?? null;
      const partFits = fitsByPart.get(page.part.id) ?? [];
      bySlug.set(slug, {
        ...page,
        slug,
        indexable:
          gaps({
            category_id: category?.id ?? null,
            attributes: page.part.attributes,
            fitments: partFits.length,
            equivalents: page.equivalents.length,
          }).length === 0,
        priceOnRequest: page.offers.length === 0,
        category,
        fits: partFits,
        requirementCars: [],
        kitCars: [],
      });
    }
    const entries = [...bySlug.values()];
    const pagesByPart = groupBy(entries, ({ part }) => part.id);
    const retired = ({ replaced_by }: PartPage['part']) =>
      replaced_by !== null && pagesByPart.has(replaced_by.id);
    const parts = [...pagesByPart.values()].map((partPages) => ({
      ...partPages[0].part,
      pages: partPages,
    }));
    const matchesFor = (vehicle: Vehicle): CarMatch[] =>
      requirementMatches(parts, vehicle.requirements).flatMap(
        ({ category_id, quantity, parts: matched }) => {
          const category = categoryById.get(category_id);
          return category
            ? [
                {
                  category,
                  quantity,
                  parts: matched.map(({ pages }) => ({
                    part: pages[0].part,
                    pages,
                    fits: [],
                  })),
                },
              ]
            : [];
        },
      );
    const fitsByVehicle = groupBy(fits, ({ vehicle_id }) => vehicle_id);
    const cars = allVehicles.map((vehicle): CarPageEntry => {
      const candidates = (fitsByVehicle.get(vehicle.id) ?? []).flatMap(
        (fit) => {
          const partPages = pagesByPart.get(fit.part_id);
          return partPages && !retired(partPages[0].part)
            ? [
                {
                  ...fit,
                  part: partPages[0].part,
                  category_id: partPages[0].part.category_id,
                  pages: partPages,
                },
              ]
            : [];
        },
      );
      const groups = positionGroups(candidates, {
        steering: vehicle.steering ?? undefined,
      }).map((group) => ({
        ...group,
        category: categoryById.get(group.category_id ?? '') ?? null,
      }));
      const matches = matchesFor(vehicle);
      const kit = maintenanceKit(
        allCategories,
        groups,
        matches.map(({ category, quantity, parts: matched }) => ({
          category_id: category.id,
          quantity,
          parts: matched.map(({ part }) => part),
        })),
      ).flatMap(({ category_id, part_id, quantity }) => {
        const partPages = pagesByPart.get(part_id) ?? [];
        const category = categoryById.get(category_id);
        return category && partPages.length
          ? [{ category, quantity, part: partPages[0].part, pages: partPages }]
          : [];
      });
      return { vehicle, groups, matches, kit };
    });
    for (const { vehicle, matches, kit } of cars) {
      for (const { pages: partPages } of matches.flatMap(
        (match) => match.parts,
      )) {
        partPages.forEach((page) => page.requirementCars.push(vehicle));
      }
      for (const { pages: partPages } of kit) {
        partPages.forEach((page) => page.kitCars.push(vehicle));
      }
    }
    return {
      categories: allCategories,
      categoryById,
      vehicles: allVehicles,
      fits,
      entries,
      pagesByPart,
      retired,
      matchesFor,
      cars,
    };
  };

  return {
    categories,
    vehicles,

    async partPages(): Promise<PartPageEntry[]> {
      return (await snapshot()).entries;
    },

    async categoryPages(): Promise<CategoryPageEntry[]> {
      const { categories: all, entries } = await snapshot();
      const bySlug = new Map(entries.map((page) => [page.slug, page]));
      const listed = entries.filter((page) => !partSuccessor(page, bySlug));
      return all.map((category) => ({
        ...category,
        pages: listed.filter((page) => page.category?.id === category.id),
      }));
    },

    async carPages(): Promise<CarPageEntry[]> {
      return (await snapshot()).cars;
    },

    async makeHubs(): Promise<MakeHubEntry[]> {
      const {
        categories: all,
        vehicles: allVehicles,
        pagesByPart,
        retired,
        matchesFor,
      } = await snapshot();
      const parts = [...pagesByPart.values()].filter(
        (pages) => !retired(pages[0].part),
      );
      const models = [
        ...groupBy(allVehicles, ({ model }) => model.slug).values(),
      ].map((vehicles): ModelHubEntry => {
        const ids = new Set(vehicles.map(({ id }) => id));
        const { model } = vehicles[0];
        const required = vehicles.flatMap(matchesFor);
        return {
          make: model.chassis.series.make,
          model,
          vehicles,
          categories: all.flatMap((category) => {
            const fitted = parts.flatMap((pages) => {
              const fits = pages[0].fits.filter(({ vehicle_id }) =>
                ids.has(vehicle_id),
              );
              return pages[0].part.category_id === category.id && fits.length
                ? [{ part: pages[0].part, pages, fits }]
                : [];
            });
            const matches = [
              ...fitted,
              ...required
                .filter((match) => match.category.id === category.id)
                .flatMap((match) => match.parts),
            ].filter(
              (match, index, all) =>
                all.findIndex(({ part }) => part.id === match.part.id) ===
                index,
            );
            return matches.length >= MODEL_CATEGORY_MIN_MATCHES
              ? [{ category, parts: matches }]
              : [];
          }),
        };
      });
      return [...groupBy(models, ({ make }) => make.slug).values()].map(
        (makeModels) => ({ make: makeModels[0].make, models: makeModels }),
      );
    },

    async search({
      q,
      category,
      model,
      locale,
      facets,
      ranges = [],
      offset = 0,
    }: SearchQuery): Promise<SearchOutcome | null> {
      const params = new URLSearchParams({
        ...(q ? { q } : {}),
        locale,
        ...(category ? { category } : {}),
        ...(model ? { model } : {}),
      });
      for (const facet of facets) {
        params.append('facets', facet);
      }
      for (const range of ranges) {
        params.append('range', rangeFilter(range));
      }
      if (offset) {
        params.set('offset', String(offset));
      }
      try {
        const found = searchResponseSchema.parse(
          await request(`/store/search?${params}`),
        );
        return {
          ...found,
          facets: pricesHidden
            ? found.facets.filter(({ key }) => key !== PRICE_FACET)
            : found.facets,
          results: found.results.map((result) => ({
            ...unpriced(result),
            slug: partPageSlug(result.brand.slug, result.normalized_value),
          })),
        };
      } catch (error) {
        console.error(
          'catalogue search failed',
          error instanceof z.ZodError ? z.prettifyError(error) : String(error),
        );
        return null;
      }
    },

    async listingScope(
      { category, model }: Pick<SearchQuery, 'category' | 'model'>,
      locale: CatalogLocale,
    ): Promise<Pick<SearchResponse, 'category' | 'model'>> {
      try {
        const [allCategories, allVehicles] = await Promise.all([
          category ? categories() : [],
          model ? vehicles() : [],
        ]);
        const named = allCategories.find(({ slug }) => slug === category);
        return {
          category: named
            ? { slug: named.slug, name: translated(named, 'name', locale) }
            : null,
          model:
            allVehicles.find((vehicle) => vehicle.model.slug === model)
              ?.model ?? null,
        };
      } catch {
        return { category: null, model: null };
      }
    },

    async offersFor(ids: string[]): Promise<Record<string, PartOffer[]>> {
      if (pricesHidden) return {};
      const batches = Array.from(
        { length: Math.ceil(ids.length / OFFERS_BATCH) },
        (_, index) =>
          ids.slice(index * OFFERS_BATCH, (index + 1) * OFFERS_BATCH),
      );
      const answers = await Promise.all(
        batches.map(async (batch) => {
          const params = new URLSearchParams(
            batch.map((id) => ['part_identifier_id', id]),
          );
          return identifierOffersResponseSchema.parse(
            await request(`/store/offers?${params}`),
          ).offers;
        }),
      );
      return Object.assign({}, ...answers);
    },

    async liveOffers(identifierId: string): Promise<OffersOutcome> {
      if (pricesHidden) return { kind: 'inquiry' };
      try {
        const { offers } = partOffersResponseSchema.parse(
          await request(
            `/store/part-identifiers/${segment(identifierId)}/offers`,
          ),
        );
        return { kind: 'offers', offers };
      } catch {
        return { kind: 'inquiry' };
      }
    },

    async addToCart(
      cartId: string | null,
      offerId: string,
      quantity = 1,
    ): Promise<CartOutcome> {
      const line = { offer_id: offerId, quantity };
      const outcome = cartId
        ? await cartOutcome(
            send(`/store/offer-carts/${segment(cartId)}/items`, 'POST', line),
            cartId,
          )
        : null;
      if (outcome && outcome.kind !== 'empty') {
        return outcome;
      }
      return cartOutcome(send('/store/offer-carts', 'POST', line));
    },

    viewCart: (cartId: string): Promise<CartOutcome> =>
      cartOutcome(
        send(`/store/offer-carts/${segment(cartId)}/reprice`, 'POST', {}),
      ),

    setQuantity: (
      cartId: string,
      itemId: string,
      quantity: number,
    ): Promise<CartOutcome> =>
      cartOutcome(
        send(
          `/store/offer-carts/${segment(cartId)}/items/${segment(itemId)}`,
          'POST',
          { quantity },
        ),
        cartId,
      ),

    setAddon: (
      cartId: string,
      itemId: string,
      on: boolean,
    ): Promise<CartOutcome> =>
      cartOutcome(
        send(
          `/store/offer-carts/${segment(cartId)}/items/${segment(itemId)}/addon`,
          on ? 'POST' : 'DELETE',
          on ? {} : undefined,
        ),
        cartId,
      ),

    removeFromCart: (cartId: string, itemId: string): Promise<CartOutcome> =>
      cartOutcome(
        send(
          `/store/offer-carts/${segment(cartId)}/items/${segment(itemId)}`,
          'DELETE',
        ),
      ),

    async placeOrder(
      cartId: string,
      contact: CheckoutContact,
      fingerprint: string,
    ): Promise<OrderOutcome> {
      try {
        const response = await send(
          `/store/offer-carts/${segment(cartId)}/complete`,
          'POST',
          { ...contact, [CART_FINGERPRINT_FIELD]: fingerprint },
        );
        if (response.status === 404) {
          return { kind: 'empty' };
        }
        const body: unknown = await response.json();
        if (response.ok) {
          return {
            kind: 'order',
            order: placedOrderResponseSchema.parse(body).order,
          };
        }
        const refusal = checkoutRefusalSchema.safeParse(body);
        return refusal.success
          ? { kind: 'refused', code: refusal.data.code }
          : { kind: 'inquiry' };
      } catch {
        return { kind: 'inquiry' };
      }
    },

    async resolveVin(vin: string): Promise<VinOutcome> {
      try {
        const lookup = vinLookupResponseSchema.parse(
          await request('/store/vin-lookups', { vin }),
        );
        return lookup.resolved
          ? { kind: 'vehicle', vehicle: lookup.vehicle, facts: lookup.facts }
          : { kind: 'inquiry', vin };
      } catch {
        return { kind: 'inquiry', vin };
      }
    },
  };
}

const tally = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count }));
};

export function categoryFacets(
  category: CategoryPageEntry,
  locale: CatalogLocale,
): SearchFacet[] {
  const { pages } = category;
  const best = pages.flatMap(({ offers }) => offers.slice(0, 1));
  const prices = best.map(({ price }) => price);
  const brandName = new Map(pages.map(({ brand }) => [brand.slug, brand.name]));
  const universal = universalFacets({
    brands: tally(pages.map(({ brand }) => brand.slug)).map((value) => ({
      ...value,
      label: brandName.get(value.value) ?? value.value,
    })),
    inStock: best.filter(({ stock_quantity }) => stock_quantity > 0).length,
    price: prices.length
      ? {
          min: Math.min(...prices),
          max: Math.max(...prices),
          count: prices.length,
        }
      : null,
    currency: best[0]?.currency ?? '',
  });
  const fields = category.fields
    .filter(({ facet }) => facet)
    .map((field) =>
      describeFacet(
        field,
        tally(
          pages.flatMap(({ part }) =>
            [part.attributes[field.key] ?? []].flat().map(String),
          ),
        ),
        locale,
      ),
    );
  return usefulFacets([...universal, ...fields], pages.length, []);
}

export const shopOpen = (env: CatalogueEnv = siteEnv()): boolean =>
  z.literal('true').safeParse(env.SHOP_OPEN).success;

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
