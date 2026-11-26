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
  cataloguePageListSchema,
  cataloguePartsHubSchema,
  categoriesResponseSchema,
  partPageSlug,
  identifierOffersResponseSchema,
  IN_STOCK_FACET,
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
  type SearchSort,
  type Vehicle,
  type VinFacts,
  CATALOGUE_ID_PATTERN,
  CATALOGUE_LOCALE_HEADER,
  MAX_OFFER_IDS,
  MAKES_PAGE_PATH,
  carMakePagePath,
  carMakePageResponseSchema,
  makePagePath,
  makePageResponseSchema,
  makesPageResponseSchema,
  categoryPagePath,
  categoryPageResponseSchema,
  partPagePath,
  partPageResponseSchema,
  type CategoryCarView,
  type SearchFacet,
  seriesCategoryPagePath,
  seriesCategoryPageResponseSchema,
  seriesPagePath,
  seriesPageResponseSchema,
  type RelatedPartPage,
  type SiteFitment,
  type SluggedPartPage,
} from '@podbor/catalog-contract';
import {
  SHOP_CLIENT_HEADER,
  SHOP_CLIENT_SECRET_HEADER,
  SHOP_PREVIEW_HEADER,
} from '@podbor/catalog-contract/preview';
import {
  REQUEST_ID_HEADER,
  VISITOR_ID_HEADER,
} from '@podbor/catalog-contract/events';
import type {
  ModelPart,
  PartCard,
  PartPageView,
  SeriesHub,
  SeriesModel,
} from './partEntry';
import type { CartOutcome, OffersOutcome } from './catalogueWire';
import { latinBrands } from './brandAliases';
import { seriesKey } from './paths';
import { byModelName } from './carName';

export type { Vehicle, VinFacts };

const carsById = (vehicles: Vehicle[]) => {
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  return {
    fits: (fits: SiteFitment[]) =>
      fits.flatMap((fit) => {
        const vehicle = byId.get(fit.vehicle_id);
        return vehicle ? [{ ...fit, vehicle }] : [];
      }),
    cars: (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []),
  };
};

export const CATALOGUE_TIMEOUT_MS = 30_000;
export const ORDER_TIMEOUT_MS = 15_000;

export type SearchQuery = {
  q?: string;
  category?: string;
  make?: string;
  model?: string;
  locale: CatalogLocale;
  facets: string[];
  ranges?: RangeFilter[];
  sort?: SearchSort | null;
  offset?: number;
  limit?: number;
  specs?: boolean;
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

export type PartPageData = {
  page: PartPageView;
  related: PartCard[];
  linkedSeries: Set<string>;
};

export type CarMakeParts = {
  hub: boolean;
  categories: Category[];
  showcase: PartCard[];
};

export type CategoryPageData = {
  category: Category;
  page: number;
  pages: number;
  count: number;
  entries: PartCard[];
  popular: PartCard[];
  facets: SearchFacet[];
  ranges: { key: string; min: number; max: number }[];
  uniform: string[];
  demanded: boolean;
  cars: CategoryCarView[];
};

export type SeriesHubData = {
  series: SeriesHub;
  models: SeriesModel[];
  categories: Category[];
  popular: PartCard[];
};

export type SeriesCategoryData = {
  series: SeriesHub;
  category: Category;
  parts: ModelPart[];
};

export type CheckoutOutcome =
  | { kind: 'order'; order: { id: string; display_id: number } }
  | { kind: 'refused'; code: CheckoutRefusal }
  | { kind: 'empty' }
  | { kind: 'inquiry' };

export const catalogueIdSchema = z.string().trim().regex(CATALOGUE_ID_PATTERN);

export type CatalogueConfig = {
  backendUrl: string;
  publishableKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  shopOpen?: boolean;
  preview?: boolean;
  previewToken?: string;
  requestId?: string;
  bot?: boolean;
  visitorId?: string;
  client?: { address: string; secret: string };
};

export function createCatalogue({
  backendUrl,
  publishableKey,
  fetch = globalThis.fetch,
  timeoutMs = CATALOGUE_TIMEOUT_MS,
  shopOpen = true,
  preview = false,
  previewToken,
  requestId,
  bot,
  visitorId,
  client,
}: CatalogueConfig) {
  const pricesHidden = !shopOpen && !preview;
  const unpriced = <T extends { offers: PartOffer[] }>(item: T): T =>
    pricesHidden ? { ...item, offers: [] } : item;
  const send = (
    path: string,
    method = 'GET',
    body?: unknown,
    signal = AbortSignal.timeout(timeoutMs),
    extraHeaders: Record<string, string> = {},
  ) =>
    fetch(`${backendUrl}${path}`, {
      method,
      headers: {
        ...extraHeaders,
        'x-publishable-api-key': publishableKey,
        ...((preview || shopOpen) &&
          previewToken && { [SHOP_PREVIEW_HEADER]: previewToken }),
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(requestId && { [REQUEST_ID_HEADER]: requestId }),
        ...(visitorId && { [VISITOR_ID_HEADER]: visitorId }),
        ...(client && {
          [SHOP_CLIENT_HEADER]: client.address,
          [SHOP_CLIENT_SECRET_HEADER]: client.secret,
        }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal,
    });

  const answer = async (path: string, body?: unknown) => {
    const response = await send(
      path,
      body === undefined ? 'GET' : 'POST',
      body,
    );
    if (!response.ok) {
      throw new Error(`Catalogue ${path} answered ${response.status}`);
    }
    return response;
  };

  const request = async (path: string, body?: unknown): Promise<unknown> =>
    (await answer(path, body)).json();

  const segment = encodeURIComponent;

  const cataloguePage = async <T>(
    path: string,
    locale: CatalogLocale,
    schema: z.ZodType<T>,
  ): Promise<T | null> => {
    const response = await send(path, 'GET', undefined, undefined, {
      [CATALOGUE_LOCALE_HEADER]: locale,
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Catalogue ${path} answered ${response.status}`);
    }
    return schema.parse(await response.json());
  };

  const partCard = (wire: RelatedPartPage): PartCard => {
    const page = unpriced(wire);
    return { ...page, priceOnRequest: page.offers.length === 0 };
  };

  const seriesCard = (page: SluggedPartPage, category: Category | null) =>
    partCard({ ...page, category });

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

  const categories = async (): Promise<Category[]> =>
    categoriesResponseSchema.parse(await request('/store/categories'))
      .categories;

  const modelNamed = async (make: string, slug: string) =>
    vehiclesResponseSchema
      .parse(
        await request(
          `/store/vehicles?${new URLSearchParams({ make, model: slug, limit: '1' })}`,
        ),
      )
      .vehicles.find((vehicle) => vehicle.model.slug === slug)?.model ?? null;

  return {
    categories,

    async partPage(
      slug: string,
      locale: CatalogLocale,
    ): Promise<PartPageData | null> {
      const found = await cataloguePage(
        partPagePath(slug),
        locale,
        partPageResponseSchema,
      );
      if (!found) return null;
      const {
        indexable,
        fits,
        requirement_cars: requirementCars,
        kit_cars: kitCars,
        ...page
      } = found.page;
      const known = carsById(found.vehicles);
      return {
        page: {
          ...partCard(page),
          indexable,
          fits: known.fits(fits),
          requirementCars: known.cars(requirementCars),
          kitCars: known.cars(kitCars),
        },
        related: found.related.map(partCard),
        linkedSeries: new Set(
          found.linked_series.map(({ make, slug }) => seriesKey(make, slug)),
        ),
      };
    },

    async seriesPage(
      make: string,
      series: string,
      locale: CatalogLocale,
    ): Promise<SeriesHubData | null> {
      const found = await cataloguePage(
        seriesPagePath(make, series),
        locale,
        seriesPageResponseSchema,
      );
      if (!found) return null;
      return {
        series: found.series,
        models: found.models
          .map(({ vehicles }) => ({ model: vehicles[0].model, vehicles }))
          .toSorted(byModelName),
        categories: found.categories,
        popular: found.popular.map((page) =>
          seriesCard(
            page,
            found.categories.find(({ id }) => id === page.part.category_id) ??
              null,
          ),
        ),
      };
    },

    async seriesCategoryPage(
      make: string,
      series: string,
      category: string,
      locale: CatalogLocale,
    ): Promise<SeriesCategoryData | null> {
      const found = await cataloguePage(
        seriesCategoryPagePath(make, series, category),
        locale,
        seriesCategoryPageResponseSchema,
      );
      if (!found) return null;
      const known = carsById(found.vehicles);
      return {
        series: found.series,
        category: found.category,
        parts: found.parts.map(({ pages, fits }) => ({
          part: pages[0].part,
          pages: pages.map((page) => seriesCard(page, found.category)),
          fits: known.fits(fits),
        })),
      };
    },

    async makesList(locale: CatalogLocale) {
      const found = await cataloguePage(
        MAKES_PAGE_PATH,
        locale,
        makesPageResponseSchema,
      );
      return found?.makes ?? [];
    },

    async carMakeParts(
      slug: string,
      locale: CatalogLocale,
    ): Promise<CarMakeParts | null> {
      const found = await cataloguePage(
        carMakePagePath(slug),
        locale,
        carMakePageResponseSchema,
      );
      if (!found) return null;
      return {
        hub: found.hub,
        categories: found.categories,
        showcase: found.showcase.map(partCard),
      };
    },

    makeHub: (slug: string, locale: CatalogLocale) =>
      cataloguePage(makePagePath(slug), locale, makePageResponseSchema),

    async categoryPage(
      slug: string,
      page: number,
      locale: CatalogLocale,
    ): Promise<CategoryPageData | null> {
      const found = await cataloguePage(
        categoryPagePath(slug, page),
        locale,
        categoryPageResponseSchema,
      );
      if (!found) return null;
      const { category, entries, popular, ...rest } = found;
      const own = (entry: (typeof entries)[number]) =>
        partCard({ ...entry, category });
      return {
        ...rest,
        category,
        entries: entries.map(own),
        popular: popular.map(own),
      };
    },

    async pageList() {
      return cataloguePageListSchema.parse(
        await request('/store/catalogue-pages'),
      );
    },

    async partsHub() {
      const path = '/store/catalogue-pages/hub';
      const response = await send(path, 'GET');
      if (response.status === 404) {
        return cataloguePartsHubSchema.parse(
          await request('/store/catalogue-pages'),
        );
      }
      if (!response.ok) {
        throw new Error(`Catalogue ${path} answered ${response.status}`);
      }
      return cataloguePartsHubSchema.parse(await response.json());
    },

    async search(query: SearchQuery): Promise<SearchOutcome | null> {
      const {
        q,
        category,
        make,
        model,
        locale,
        facets,
        ranges = [],
        offset = 0,
        limit,
        sort = null,
        specs: withSpecs = false,
      } = query;
      const params = new URLSearchParams({
        ...(q ? { q: latinBrands(q) } : {}),
        locale,
        ...(category ? { category } : {}),
        ...(make && model ? { make, model } : {}),
        ...(sort ? { sort } : {}),
      });
      for (const facet of facets) {
        if (!pricesHidden || !facet.startsWith(`${IN_STOCK_FACET}:`))
          params.append('facets', facet);
      }
      for (const range of ranges) {
        if (!pricesHidden || range.key !== PRICE_FACET)
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
        const described =
          withSpecs && found.results.some(({ part }) => part.attributes);
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
            ? found.facets.filter(
                ({ key }) => key !== PRICE_FACET && key !== IN_STOCK_FACET,
              )
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
        const stalled =
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError');
        return sort && !stalled ? this.search({ ...query, sort: null }) : null;
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
          make && model ? modelNamed(make, model) : null,
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
        { length: Math.ceil(ids.length / MAX_OFFER_IDS) },
        (_, index) =>
          ids.slice(index * MAX_OFFER_IDS, (index + 1) * MAX_OFFER_IDS),
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
          await request('/store/vin-lookups', {
            vin,
            bot: bot ?? null,
            visitor_id: visitorId ?? null,
          }),
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
