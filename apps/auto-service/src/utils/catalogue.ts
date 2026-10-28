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
  type Category,
  type SearchResponse,
  type SearchResult,
  type Vehicle,
  type VinFacts,
} from '@podbor/catalog-contract';
import { SHOP_PREVIEW_HEADER } from '@podbor/catalog-contract/preview';
import {
  assembleSnapshot,
  categoryPagesFrom,
  makeHubsFrom,
  type CarPageEntry,
  type CategoryPageEntry,
  type MakeHubEntry,
  type PartPageEntry,
} from './catalogueSnapshot';

export type { Vehicle, VinFacts };

export const CATALOGUE_TIMEOUT_MS = 10_000;
export const ORDER_TIMEOUT_MS = 25_000;
const PAGE_BATCH = 1000;
const OFFERS_BATCH = 100;

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

export const LINE_ADDON_KINDS = ['addon', 'installation'] as const;
export type LineAddonKind = (typeof LINE_ADDON_KINDS)[number];

export type IdentifierPrices = {
  offers: Record<string, PartOffer[]>;
  installation: Record<string, number | null>;
};

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
    timeout = timeoutMs,
  ) =>
    fetch(`${backendUrl}${path}`, {
      method,
      headers: {
        'x-publishable-api-key': publishableKey,
        ...((preview || shopOpen) && { [SHOP_PREVIEW_HEADER]: '1' }),
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeout),
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
        pricesHidden
          ? { ...category, service_price: null, installation_price: null }
          : category,
      );

  const vehicles = async (): Promise<Vehicle[]> =>
    vehiclesResponseSchema.parse(await request('/store/vehicles')).vehicles;

  const snapshot = async () => {
    const [pages, allCategories, fitments, allVehicles] = await Promise.all([
      paged('/store/part-pages', (body) => {
        const { pages, count } = partPagesResponseSchema.parse(body);
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
          count,
        };
      }),
      categories(),
      paged('/store/fitments', (body) => {
        const { fitments, count } = fitmentsResponseSchema.parse(body);
        return { items: fitments, count };
      }),
      vehicles(),
    ]);
    return assembleSnapshot(pages, allCategories, fitments, allVehicles);
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
      return (await snapshot()).cars;
    },

    async makeHubs(): Promise<MakeHubEntry[]> {
      return makeHubsFrom(await snapshot());
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
      kind: LineAddonKind = 'addon',
    ): Promise<CartOutcome> =>
      cartOutcome(
        send(
          `/store/offer-carts/${segment(cartId)}/items/${segment(itemId)}/${kind}`,
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
      const complete = () =>
        send(
          `/store/offer-carts/${segment(cartId)}/complete`,
          'POST',
          { ...contact, [CART_FINGERPRINT_FIELD]: fingerprint },
          ORDER_TIMEOUT_MS,
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
          ? { kind: 'vehicle', vehicle: lookup.vehicle, facts: lookup.facts }
          : { kind: 'inquiry', vin };
      } catch {
        return { kind: 'inquiry', vin };
      }
    },
  };
}
