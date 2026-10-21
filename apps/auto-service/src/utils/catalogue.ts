import {
  checkoutRefusalSchema,
  offerCartResponseSchema,
  partOffersResponseSchema,
  placedOrderResponseSchema,
  type CheckoutRefusal,
  type OfferCart,
  type PartOffer,
  categoriesResponseSchema,
  partPageSlug,
  partPagesResponseSchema,
  searchResponseSchema,
  vehiclesResponseSchema,
  vinLookupResponseSchema,
  type CatalogLocale,
  type Category,
  type PartPage,
  type SearchResponse,
  type SearchResult,
  type Vehicle,
  type VinFacts,
} from '@podbor/catalog-contract';

export type { Vehicle, VinFacts };

export const CATALOGUE_TIMEOUT_MS = 10_000;
const PART_PAGES_BATCH = 1000;

export type PartPageEntry = PartPage & {
  slug: string;
  indexable: boolean;
  priceOnRequest: boolean;
  category: Category | null;
};

export type SearchQuery = {
  q: string;
  locale: CatalogLocale;
  facets: string[];
  offset?: number;
};

export type SearchOutcome = Omit<SearchResponse, 'results'> & {
  results: (SearchResult & { slug: string })[];
};

export type CategoryPageEntry = Category & { pages: PartPageEntry[] };

export type VinOutcome =
  | { kind: 'vehicle'; vehicle: Vehicle; facts: VinFacts }
  | { kind: 'inquiry'; vin: string };

export type OffersOutcome =
  { kind: 'offers'; offers: PartOffer[] } | { kind: 'inquiry' };

export type CartOutcome =
  { kind: 'cart'; cart: OfferCart } | { kind: 'empty' } | { kind: 'inquiry' };

export type OrderOutcome =
  | { kind: 'order'; order: { id: string; display_id: number } }
  | { kind: 'refused'; code: CheckoutRefusal }
  | { kind: 'inquiry' };

export type CheckoutContact = {
  contact: string;
  contact_channel?: 'phone' | 'telegram' | 'whatsapp' | 'viber';
  name?: string;
  vin?: string;
  comment?: string;
  locale?: CatalogLocale;
};

export type CatalogueConfig = {
  backendUrl: string;
  publishableKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

export type CatalogueEnv = {
  MEDUSA_BACKEND_URL?: string;
  MEDUSA_PUBLISHABLE_KEY?: string;
};

export function createCatalogue({
  backendUrl,
  publishableKey,
  fetch = globalThis.fetch,
  timeoutMs = CATALOGUE_TIMEOUT_MS,
}: CatalogueConfig) {
  const send = (path: string, method = 'GET', body?: unknown) =>
    fetch(`${backendUrl}${path}`, {
      method,
      headers: {
        'x-publishable-api-key': publishableKey,
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

  const cartOutcome = async (
    answer: Promise<Response>,
  ): Promise<CartOutcome> => {
    try {
      const response = await answer;
      if (response.status === 404) {
        return { kind: 'empty' };
      }
      if (!response.ok) {
        return { kind: 'inquiry' };
      }
      const { cart } = offerCartResponseSchema.parse(await response.json());
      return cart.completed || cart.items.length === 0
        ? { kind: 'empty' }
        : { kind: 'cart', cart };
    } catch {
      return { kind: 'inquiry' };
    }
  };

  const newCartId = async () =>
    offerCartResponseSchema.parse(await request('/store/offer-carts', {})).cart
      .id;

  const categories = async (): Promise<Category[]> =>
    categoriesResponseSchema.parse(await request('/store/categories'))
      .categories;

  const allPartPages = async (): Promise<PartPage[]> => {
    const all: PartPage[] = [];
    for (let offset = 0; ;) {
      const { pages, count } = partPagesResponseSchema.parse(
        await request(
          `/store/part-pages?offset=${offset}&limit=${PART_PAGES_BATCH}`,
        ),
      );
      all.push(...pages);
      offset += pages.length;
      if (pages.length === 0 || offset >= count) {
        return all;
      }
    }
  };

  const partPages = async (known?: Category[]): Promise<PartPageEntry[]> => {
    const pages = await allPartPages();
    const byId = new Map(
      (pages.some(({ part }) => part.category_id)
        ? (known ?? (await categories()))
        : []
      ).map((category) => [category.id, category]),
    );
    const bySlug = new Map<string, PartPageEntry>();
    for (const page of pages) {
      const slug = partPageSlug(page.brand.slug, page.normalized_value);
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          ...page,
          slug,
          indexable: false,
          priceOnRequest: page.offers.length === 0,
          category: byId.get(page.part.category_id ?? '') ?? null,
        });
      }
    }
    return [...bySlug.values()];
  };

  return {
    categories,
    partPages: () => partPages(),

    async categoryPages(): Promise<CategoryPageEntry[]> {
      const all = await categories();
      const pages = await partPages(all);
      return all.map((category) => ({
        ...category,
        pages: pages.filter((page) => page.category?.id === category.id),
      }));
    },

    async vehicles(): Promise<Vehicle[]> {
      return vehiclesResponseSchema.parse(await request('/store/vehicles'))
        .vehicles;
    },

    async search({
      q,
      locale,
      facets,
      offset = 0,
    }: SearchQuery): Promise<SearchOutcome | null> {
      const params = new URLSearchParams({ q, locale });
      for (const facet of facets) {
        params.append('facets', facet);
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
          results: found.results.map((result) => ({
            ...result,
            slug: partPageSlug(result.brand.slug, result.normalized_value),
          })),
        };
      } catch {
        return null;
      }
    },

    async liveOffers(identifierId: string): Promise<OffersOutcome> {
      try {
        const { offers } = partOffersResponseSchema.parse(
          await request(`/store/part-identifiers/${identifierId}/offers`),
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
      const add = (id: string) =>
        send(`/store/offer-carts/${id}/items`, 'POST', {
          offer_id: offerId,
          quantity,
        });
      const outcome = cartId ? await cartOutcome(add(cartId)) : null;
      if (outcome && outcome.kind !== 'empty') {
        return outcome;
      }
      return cartOutcome(newCartId().then(add));
    },

    viewCart: (cartId: string): Promise<CartOutcome> =>
      cartOutcome(send(`/store/offer-carts/${cartId}/reprice`, 'POST', {})),

    removeFromCart: (cartId: string, itemId: string): Promise<CartOutcome> =>
      cartOutcome(
        send(`/store/offer-carts/${cartId}/items/${itemId}`, 'DELETE'),
      ),

    async placeOrder(
      cartId: string,
      contact: CheckoutContact,
    ): Promise<OrderOutcome> {
      try {
        const response = await send(
          `/store/offer-carts/${cartId}/complete`,
          'POST',
          contact,
        );
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

export function catalogueFromEnv(env: CatalogueEnv) {
  return env.MEDUSA_BACKEND_URL
    ? createCatalogue({
        backendUrl: env.MEDUSA_BACKEND_URL,
        publishableKey: env.MEDUSA_PUBLISHABLE_KEY ?? '',
      })
    : null;
}

export const siteEnv = (): CatalogueEnv => ({
  MEDUSA_BACKEND_URL: import.meta.env.MEDUSA_BACKEND_URL,
  MEDUSA_PUBLISHABLE_KEY: import.meta.env.MEDUSA_PUBLISHABLE_KEY,
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

export async function vehiclesForBuild(env: CatalogueEnv): Promise<Vehicle[]> {
  return (await catalogueFromEnv(env)?.vehicles()) ?? [];
}
