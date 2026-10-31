import { keySpecs } from './attributeRows';
import { z } from 'zod';
import {
  CART_FINGERPRINT_FIELD,
  type AddonKind,
  checkoutRefusalSchema,
  offerCartResponseSchema,
  partOffersResponseSchema,
  placedOrderResponseSchema,
  type CheckoutContact,
  type CheckoutRefusal,
  type PartOffer,
  categoriesResponseSchema,
  catalogueRedirectsResponseSchema,
  type CatalogueRedirect,
  fitmentsResponseSchema,
  partPageSlug,
  identifierOffersResponseSchema,
  partPagesResponseSchema,
  PRICE_FACET,
  rangeFilter,
  type RangeFilter,
  searchResponseSchema,
  translated,
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  type CatalogLocale,
  type CarHit,
  type Category,
  type SearchResponse,
  type SearchResult,
  type Vehicle,
  type VinFacts,
} from '@podbor/catalog-contract';
import { SHOP_PREVIEW_HEADER } from '@podbor/catalog-contract/preview';
import {
  assembleSnapshot,
  carPagesFrom,
  categoryPagesFrom,
  makeHubsFrom,
  type CarPageEntry,
  type CategoryPageEntry,
  type MakeHubEntry,
  type PartPageEntry,
} from './catalogueSnapshot';
import type { CartOutcome, OffersOutcome } from './catalogueWire';

export type { Vehicle, VinFacts };

export const CATALOGUE_TIMEOUT_MS = 10_000;
export const ORDER_TIMEOUT_MS = 15_000;
const PAGE_BATCH = 1000;
const OFFERS_BATCH = 100;

export type SearchQuery = {
  q?: string;
  category?: string;
  make?: string;
  model?: string;
  locale: CatalogLocale;
  facets: string[];
  ranges?: RangeFilter[];
  offset?: number;
  limit?: number;
};

export type SearchOutcome = Omit<SearchResponse, 'results'> & {
  results: (SearchResult & { slug: string; specs: string })[];
};

const ADDON_ROUTES: Record<AddonKind, string> = {
  service: 'addon',
  installation: 'installation',
};

export type IdentifierPrices = {
  offers: Record<string, PartOffer[]>;
  installation: Record<string, number | null>;
};

export type VinOutcome =
  | {
      kind: 'vehicle';
      vehicle: Vehicle;
      facts: VinFacts;
      place: CarHit | null;
    }
  | { kind: 'inquiry'; vin: string; place: CarHit | null };

export type CheckoutOutcome =
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
  const send = (
    path: string,
    method = 'GET',
    body?: unknown,
    signal = AbortSignal.timeout(timeoutMs),
  ) =>
    fetch(`${backendUrl}${path}`, {
      method,
      headers: {
        'x-publishable-api-key': publishableKey,
        ...((preview || shopOpen) && { [SHOP_PREVIEW_HEADER]: '1' }),
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal,
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

  const viewCart = (cartId: string): Promise<CartOutcome> =>
    cartOutcome(
      send(`/store/offer-carts/${segment(cartId)}/reprice`, 'POST', {}),
    );

  const lineOutcome = (answer: Promise<Response>, cartId: string) =>
    cartOutcome(answer, cartId, () => viewCart(cartId));

  const cartOutcome = async (
    answer: Promise<Response>,
    cartId: string | null = null,
    missing: () => Promise<CartOutcome> = async () => ({ kind: 'empty' }),
  ): Promise<CartOutcome> => {
    try {
      const response = await answer;
      if (response.status === 404) {
        return missing();
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
    read: (body: unknown) => { items: T[]; next: string | null },
  ): Promise<T[]> => {
    const all: T[] = [];
    for (let after: string | null = null; ;) {
      const page = new URLSearchParams({
        limit: String(PAGE_BATCH),
        ...(after && { after }),
      });
      const { items, next } = read(await request(`${path}?${page}`));
      all.push(...items);
      if (!next) return all;
      after = next;
    }
  };

  const categories = async (): Promise<Category[]> =>
    categoriesResponseSchema
      .parse(await request('/store/categories'))
      .categories.map((category) =>
        pricesHidden
          ? { ...category, service_price: null, installation_price: null }
          : category,
      );

  const vehicles = (): Promise<Vehicle[]> =>
    paged('/store/vehicles', (body) => {
      const { vehicles, next } = vehiclesResponseSchema.parse(body);
      return { items: vehicles, next };
    });

  const modelNamed = async (make: string | undefined, slug: string) =>
    vehiclesResponseSchema
      .parse(
        await request(
          `/store/vehicles?${new URLSearchParams({ ...(make && { make }), model: slug, limit: '1' })}`,
        ),
      )
      .vehicles.find((vehicle) => vehicle.model.slug === slug)?.model ?? null;

  const redirects = async (): Promise<CatalogueRedirect[]> => {
    const path = '/store/catalogue-redirects';
    const response = await send(path);
    if (response.status === 404) {
      return [];
    }
    if (!response.ok) {
      throw new Error(`Catalogue ${path} answered ${response.status}`);
    }
    return catalogueRedirectsResponseSchema.parse(await response.json())
      .redirects;
  };

  const snapshot = async () => {
    const [pages, allCategories, fitments, allVehicles, allRedirects] =
      await Promise.all([
        paged('/store/part-pages', (body) => {
          const { pages, next } = partPagesResponseSchema.parse(body);
          return {
            items: pages.map((page) =>
              unpriced({
                ...page,
                part: {
                  ...page.part,
                  installation_price: pricesHidden
                    ? null
                    : page.part.installation_price,
                },
              }),
            ),
            next,
          };
        }),
        categories(),
        paged('/store/fitments', (body) => {
          const { fitments, next } = fitmentsResponseSchema.parse(body);
          return { items: fitments, next };
        }),
        vehicles(),
        redirects(),
      ]);
    return assembleSnapshot(
      pages,
      allCategories,
      fitments,
      allVehicles,
      allRedirects,
    );
  };

  return {
    categories,
    vehicles,
    snapshot,

    async partPages(): Promise<PartPageEntry[]> {
      return (await snapshot()).entries;
    },

    async categoryPages(): Promise<CategoryPageEntry[]> {
      return categoryPagesFrom(await snapshot());
    },

    async carPages(): Promise<CarPageEntry[]> {
      return carPagesFrom(await snapshot());
    },

    async makeHubs(): Promise<MakeHubEntry[]> {
      return makeHubsFrom(await snapshot());
    },

    async search({
      q,
      category,
      make,
      model,
      locale,
      facets,
      ranges = [],
      offset = 0,
      limit,
    }: SearchQuery): Promise<SearchOutcome | null> {
      const params = new URLSearchParams({
        ...(q ? { q } : {}),
        locale,
        ...(category ? { category } : {}),
        ...(model ? { ...(make && { make }), model } : {}),
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
      if (limit) {
        params.set('limit', String(limit));
      }
      try {
        const found = searchResponseSchema.parse(
          await request(`/store/search?${params}`),
        );
        const described = found.results.some(({ part }) => part.attributes);
        const bySlug = new Map(
          described
            ? (await categories().catch(() => [])).map((named) => [
                named.slug,
                named,
              ])
            : [],
        );
        const sameCategory = (results: SearchResult[], slug?: string) =>
          results.flatMap((other) =>
            other.part.attributes && other.part.category?.slug === slug
              ? [other.part.attributes]
              : [],
          );
        const lone = [...bySlug.keys()].filter(
          (slug) =>
            found.results.some(({ part }) => part.category?.slug === slug) &&
            sameCategory(found.results, slug).length < 2,
        );
        const peers = new Map(
          await Promise.all(
            lone.map(async (slug) => {
              const listed = await request(
                `/store/search?${new URLSearchParams({ locale, category: slug, limit: '100' })}`,
              )
                .then((body) => searchResponseSchema.parse(body).results)
                .catch(() => []);
              return [slug, sameCategory(listed, slug)] as const;
            }),
          ),
        );
        const specs = ({ part }: SearchResult) => {
          const slug = part.category?.slug;
          const named = bySlug.get(slug ?? '');
          const listing =
            peers.get(slug ?? '') ?? sameCategory(found.results, slug);
          return named && part.attributes
            ? keySpecs(named, part.attributes, locale, listing)
            : '';
        };
        return {
          ...found,
          facets: pricesHidden
            ? found.facets.filter(({ key }) => key !== PRICE_FACET)
            : found.facets,
          results: found.results.map((result) => ({
            ...unpriced(result),
            slug: partPageSlug(result.brand.slug, result.normalized_value),
            specs: specs(result),
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
      {
        category,
        make,
        model,
      }: Pick<SearchQuery, 'category' | 'make' | 'model'>,
      locale: CatalogLocale,
    ): Promise<Pick<
      SearchResponse,
      'category' | 'model' | 'scope_pages'
    > | null> {
      try {
        const [allCategories, namedModel] = await Promise.all([
          category ? categories() : [],
          model ? modelNamed(make, model) : null,
        ]);
        const named = allCategories.find(({ slug }) => slug === category);
        return {
          category: named
            ? { slug: named.slug, name: translated(named, 'name', locale) }
            : null,
          model: namedModel,
          scope_pages: null,
        };
      } catch {
        return null;
      }
    },

    async offersFor(ids: string[]): Promise<IdentifierPrices> {
      if (pricesHidden) return { offers: {}, installation: {} };
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
          );
        }),
      );
      return {
        offers: Object.assign({}, ...answers.map(({ offers }) => offers)),
        installation: Object.assign(
          {},
          ...answers.map(({ installation }) => installation),
        ),
      };
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

    viewCart,

    setQuantity: (
      cartId: string,
      itemId: string,
      quantity: number,
    ): Promise<CartOutcome> =>
      lineOutcome(
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
      kind: AddonKind,
    ): Promise<CartOutcome> =>
      lineOutcome(
        send(
          `/store/offer-carts/${segment(cartId)}/items/${segment(itemId)}/${ADDON_ROUTES[kind]}`,
          on ? 'POST' : 'DELETE',
          on ? {} : undefined,
        ),
        cartId,
      ),

    removeFromCart: (cartId: string, itemId: string): Promise<CartOutcome> =>
      lineOutcome(
        send(
          `/store/offer-carts/${segment(cartId)}/items/${segment(itemId)}`,
          'DELETE',
        ),
        cartId,
      ),

    async placeOrder(
      cartId: string,
      contact: CheckoutContact,
      fingerprint: string,
    ): Promise<CheckoutOutcome> {
      const deadline = AbortSignal.timeout(ORDER_TIMEOUT_MS);
      const complete = () =>
        send(
          `/store/offer-carts/${segment(cartId)}/complete`,
          'POST',
          { ...contact, [CART_FINGERPRINT_FIELD]: fingerprint },
          deadline,
        );
      try {
        const response = await complete().catch(complete);
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
          ? {
              kind: 'vehicle',
              vehicle: lookup.vehicle,
              facts: lookup.facts,
              place: lookup.place,
            }
          : { kind: 'inquiry', vin, place: lookup.place };
      } catch {
        return { kind: 'inquiry', vin, place: null };
      }
    },
  };
}
