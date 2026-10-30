import type {
  BigNumberValue,
  ICartModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MathBN,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils';
import {
  addToCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  deleteLineItemsWorkflow,
  updateLineItemInCartWorkflow,
} from '@medusajs/medusa/core-flows';
import {
  CATALOG_TRANSLATION_LOCALES,
  orderCap,
  partPageSlug,
  translationsSchema,
  type CheckoutRefusal,
  type LineAddon,
  type OfferCart,
} from '@podbor/catalog-contract';
import { SHOP_PREVIEW_HEADER } from '@podbor/catalog-contract/preview';
import { PARTS_ORDER_COPY } from '@podbor/lead-crm/parts-order-copy';

import type { MedusaRequest } from '@medusajs/framework/http';
import { z } from 'zod';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { sellPrice } from '../modules/supplier/pricing';
import { parseEnv } from './env';
import { installationPrice } from './installation';
import {
  addonLineMetadata,
  type AddonKind,
  INSTALLATION,
  listedPartOf,
  offerLineMetadata,
  readinessMetadata,
  readLine,
} from './line-metadata';
import { liveOffers } from './suppliers/live-quote';

export { INSTALLATION, type AddonKind };

export const CASH_AT_PICKUP_PROVIDER_ID = 'pp_system_default';
export const CASH_AT_PICKUP_METADATA = { fulfillment: 'cash_at_pickup' };

export type OfferCartLineItem = {
  id: string;
  title?: string;
  quantity: BigNumberValue;
  unit_price: BigNumberValue;
  metadata?: Record<string, unknown> | null;
};

const offerIdOf = (item: OfferCartLineItem) =>
  readLine(item.metadata).offerId ?? undefined;

const parentOfferIdOf = (item: OfferCartLineItem) =>
  readLine(item.metadata).parentOfferId;

const kindOf = (item: OfferCartLineItem) => readLine(item.metadata).addonKind;

const addonKey = (parentOfferId: string | null, kind: AddonKind | null) =>
  `${parentOfferId}:${kind}`;

type CategoryAddon = Omit<LineAddon, 'item_id'>;

type ServiceCategory = {
  service_label: string | null;
  service_price: number | null;
  translations: unknown;
};

const addonLabelTranslations = ({
  translations,
}: ServiceCategory): LineAddon['translations'] => {
  const stored = translationsSchema.parse(translations ?? null);
  const labels = CATALOG_TRANSLATION_LOCALES.flatMap((locale) => {
    const label = stored?.[locale]?.service_label;
    return label ? [[locale, { label }]] : [];
  });
  return labels.length ? Object.fromEntries(labels) : null;
};

const categoryAddon = (
  category: ServiceCategory | null | undefined,
): CategoryAddon | null =>
  category?.service_label && category.service_price !== null
    ? {
        label: category.service_label,
        translations: addonLabelTranslations(category),
        unit_price: category.service_price,
      }
    : null;

type LineServices = {
  service: CategoryAddon | null;
  installation: number | null;
};

const priceFor = (services: LineServices | undefined, kind: AddonKind) =>
  kind === INSTALLATION
    ? (services?.installation ?? null)
    : (services?.service?.unit_price ?? null);

const servicesOf = async (
  scope: MedusaContainer,
  items: OfferCartLineItem[],
): Promise<Map<string, LineServices>> => {
  const lines = items.flatMap((item) => {
    const { offerId, partIdentifierId } = readLine(item.metadata);
    return offerId && partIdentifierId
      ? [{ offerId, identifierId: partIdentifierId }]
      : [];
  });
  if (!lines.length) {
    return new Map();
  }
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const identifiers = await catalog.listPartIdentifiers(
    { id: lines.map(({ identifierId }) => identifierId) },
    { relations: ['part', 'part.category'], take: null },
  );
  const servicesByIdentifier = new Map(
    identifiers.map(({ id, part }) => [
      id,
      {
        service: categoryAddon(part?.category),
        installation: part ? installationPrice(part) : null,
      },
    ]),
  );
  return new Map(
    lines.flatMap(({ offerId, identifierId }) => {
      const services = servicesByIdentifier.get(identifierId);
      return services ? [[offerId, services]] : [];
    }),
  );
};

export const refuseStockCartChange = (
  _req: unknown,
  _res: unknown,
  next: (error: MedusaError) => void,
): void =>
  next(
    new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'Carts change only through /store/offer-carts',
    ),
  );

const previewHeaderSchema = z.literal('1');

const shopOpen = (): boolean => parseEnv(process.env).SHOP_OPEN;

export const pricesShown = (req: Pick<MedusaRequest, 'headers'>): boolean =>
  shopOpen() ||
  previewHeaderSchema.safeParse(req.headers[SHOP_PREVIEW_HEADER]).success;

export const refuseClosedShop = (
  req: MedusaRequest,
  _res: unknown,
  next: (error?: MedusaError) => void,
): void =>
  pricesShown(req)
    ? next()
    : next(
        new MedusaError(
          MedusaError.Types.FORBIDDEN,
          'The shop sells only to preview visitors while it is closed',
        ),
      );

export const refuse = (code: CheckoutRefusal, message: string): never => {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message, code);
};

type LiveOffer = Awaited<ReturnType<typeof liveOffers>>[number];

const offersOf = async (
  scope: MedusaContainer,
  items: OfferCartLineItem[],
): Promise<Map<string, LiveOffer>> => {
  const ids = items.map(offerIdOf).filter((id) => id !== undefined);
  const offers = ids.length ? await liveOffers(scope, { id: ids }) : [];
  return new Map(offers.map((offer) => [offer.id, offer]));
};

const priceOf = (offer: LiveOffer) =>
  sellPrice(offer.cost_price, offer.supplier.markup_percentage);

const stampReadiness = async (
  scope: MedusaContainer,
  item: OfferCartLineItem,
  offer: LiveOffer,
) => {
  const readiness = readinessMetadata(
    offer.stock_quantity > 0,
    offer.lead_time_days,
  );
  const stamped = readLine(item.metadata);
  if (
    stamped.inStock !== readiness.in_stock ||
    stamped.leadTimeDays !== readiness.lead_time_days
  ) {
    await scope
      .resolve<ICartModuleService>(Modules.CART)
      .updateLineItems(item.id, {
        metadata: { ...item.metadata, ...readiness },
      });
  }
  return readiness;
};

async function ensureCashAtPickupPaymentSession(
  container: MedusaContainer,
  cartId: string,
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [cart],
  } = await query.graph({
    entity: 'cart',
    filters: { id: cartId },
    fields: ['id', 'payment_collection.id'],
  });

  let paymentCollectionId = cart?.payment_collection?.id;

  if (!paymentCollectionId) {
    const { result } = await createPaymentCollectionForCartWorkflow(
      container,
    ).run({ input: { cart_id: cartId } });
    paymentCollectionId = result.id;
  }

  await createPaymentSessionsWorkflow(container).run({
    input: {
      payment_collection_id: paymentCollectionId,
      provider_id: CASH_AT_PICKUP_PROVIDER_ID,
    },
  });
}

const retrieveCart = (scope: MedusaContainer, cartId: string) =>
  scope
    .resolve<ICartModuleService>(Modules.CART)
    .retrieveCart(cartId, { relations: ['items'] });

async function syncOfferCart(
  scope: MedusaContainer,
  cartId: string,
  changed = false,
): Promise<OfferCart> {
  const cart = await retrieveCart(scope, cartId);
  const currency = cart.currency_code.toUpperCase();
  if (cart.completed_at) {
    return { id: cart.id, completed: true, currency, total: 0, items: [] };
  }
  const items = [...(cart.items ?? [])].sort(
    (a, b) =>
      new Date(a.created_at ?? 0).getTime() -
        new Date(b.created_at ?? 0).getTime() || a.id.localeCompare(b.id),
  );
  const live = await offersOf(scope, items);
  const services = await servicesOf(scope, items);
  const addonLines = new Map(
    items.flatMap((item) =>
      kindOf(item)
        ? [[addonKey(parentOfferIdOf(item), kindOf(item)), item]]
        : [],
    ),
  );
  const orphans = items.filter((item) => {
    const kind = kindOf(item);
    const parent = parentOfferIdOf(item);
    return (
      kind &&
      (!parent ||
        priceFor(services.get(parent), kind) === null ||
        addonLines.get(addonKey(parent, kind)) !== item)
    );
  });
  let repriced = changed;
  if (orphans.length) {
    await deleteLineItemsWorkflow(scope).run({
      input: { cart_id: cartId, ids: orphans.map(({ id }) => id) },
    });
    repriced = true;
  }
  const lines: OfferCart['items'] = [];
  for (const item of items) {
    const offerId = offerIdOf(item);
    if (!offerId || kindOf(item)) {
      continue;
    }
    const offer = live.get(offerId);
    let unitPrice = Number(item.unit_price);
    if (offer && !MathBN.eq(priceOf(offer), unitPrice)) {
      unitPrice = priceOf(offer);
      await updateLineItemInCartWorkflow(scope).run({
        input: {
          cart_id: cartId,
          item_id: item.id,
          update: { unit_price: unitPrice },
        },
      });
      repriced = true;
    }
    const quantity = Number(item.quantity);
    const readiness = offer
      ? await stampReadiness(scope, item, offer)
      : { in_stock: false, lead_time_days: 0 };
    const lineServices = services.get(offerId);
    const service = lineServices?.service ?? null;
    const installation = lineServices?.installation ?? null;
    const added = (kind: AddonKind) =>
      priceFor(lineServices, kind) === null
        ? undefined
        : addonLines.get(addonKey(offerId, kind));
    for (const kind of ['service', INSTALLATION] as const) {
      const addonLine = added(kind);
      const price = priceFor(lineServices, kind);
      if (
        addonLine &&
        price !== null &&
        (!MathBN.eq(price, addonLine.unit_price) ||
          Number(addonLine.quantity) !== quantity)
      ) {
        await updateLineItemInCartWorkflow(scope).run({
          input: {
            cart_id: cartId,
            item_id: addonLine.id,
            update: { unit_price: price, quantity },
          },
        });
        repriced = true;
      }
    }
    lines.push({
      id: item.id,
      offer_id: offerId,
      quantity,
      unit_price: unitPrice,
      available: !!offer && orderCap(offer) >= quantity,
      ...readiness,
      addon: service
        ? { item_id: added('service')?.id ?? null, ...service }
        : null,
      installation:
        installation === null
          ? null
          : {
              item_id: added(INSTALLATION)?.id ?? null,
              unit_price: installation,
            },
      part: listedPartOf(item.metadata, item.title),
    });
  }
  if (repriced && items.length) {
    await ensureCashAtPickupPaymentSession(scope, cartId);
  }
  return {
    id: cart.id,
    completed: false,
    currency,
    total: lines.reduce(
      (sum, line) =>
        sum +
        line.unit_price * line.quantity +
        (line.addon?.item_id ? line.addon.unit_price * line.quantity : 0) +
        (line.installation?.item_id
          ? line.installation.unit_price * line.quantity
          : 0),
      0,
    ),
    items: lines,
  };
}

const openCart = async (scope: MedusaContainer, cartId: string) => {
  const cart = await retrieveCart(scope, cartId);
  if (cart.completed_at) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Cart ${cartId} is already an order`,
    );
  }
  return cart;
};

export async function removeOfferLine(
  scope: MedusaContainer,
  cartId: string,
  itemId: string,
): Promise<OfferCart> {
  const cart = await openCart(scope, cartId);
  const items = cart.items ?? [];
  const line = items.find((item) => item.id === itemId);
  if (!line) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Cart ${cartId} has no line ${itemId}`,
    );
  }
  const offerId = offerIdOf(line);
  await deleteLineItemsWorkflow(scope).run({
    input: {
      cart_id: cartId,
      ids: [
        itemId,
        ...items
          .filter(
            (item) =>
              offerId && kindOf(item) && parentOfferIdOf(item) === offerId,
          )
          .map(({ id }) => id),
      ],
    },
  });
  return syncOfferCart(scope, cartId, true);
}

const offerLine = async (
  scope: MedusaContainer,
  cartId: string,
  itemId: string,
  kind: AddonKind,
) => {
  const cart = await openCart(scope, cartId);
  const items = cart.items ?? [];
  const line = items.find((item) => item.id === itemId && offerIdOf(item));
  if (!line) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Cart ${cartId} has no line ${itemId}`,
    );
  }
  return {
    line,
    addonLines: items.filter(
      (item) =>
        kindOf(item) === kind && parentOfferIdOf(item) === offerIdOf(line),
    ),
  };
};

export async function addLineAddon(
  scope: MedusaContainer,
  cartId: string,
  itemId: string,
  kind: AddonKind = 'service',
): Promise<OfferCart> {
  const { line, addonLines } = await offerLine(scope, cartId, itemId, kind);
  const offerId = offerIdOf(line)!;
  const lineServices = (await servicesOf(scope, [line])).get(offerId);
  const price = priceFor(lineServices, kind);
  if (price === null) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Line ${itemId} has no ${kind} add-on`,
    );
  }
  if (!addonLines.length) {
    await addToCartWorkflow(scope).run({
      input: {
        cart_id: cartId,
        items: [
          {
            title:
              kind === INSTALLATION
                ? PARTS_ORDER_COPY.installation
                : lineServices!.service!.label,
            quantity: Number(line.quantity),
            unit_price: price,
            requires_shipping: false,
            metadata: addonLineMetadata(offerId, kind),
          },
        ],
      },
    });
  }
  return syncOfferCart(scope, cartId, true);
}

export async function removeLineAddon(
  scope: MedusaContainer,
  cartId: string,
  itemId: string,
  kind: AddonKind = 'service',
): Promise<OfferCart> {
  const { addonLines } = await offerLine(scope, cartId, itemId, kind);
  if (addonLines.length) {
    await deleteLineItemsWorkflow(scope).run({
      input: { cart_id: cartId, ids: addonLines.map(({ id }) => id) },
    });
  }
  return syncOfferCart(scope, cartId, true);
}

async function sellableOffer(
  scope: MedusaContainer,
  offerId: string,
  quantity: number,
) {
  const [offer] = await liveOffers(scope, { id: [offerId] });
  if (!offer) {
    return refuse('OFFER_MISSING', `Offer ${offerId} cannot be sold now`);
  }
  if (orderCap(offer) < quantity) {
    return refuse('OFFER_OUT_OF_STOCK', `Only ${orderCap(offer)} can be sold`);
  }
  return offer;
}

async function putOffer(
  scope: MedusaContainer,
  cartId: string,
  offerId: string,
  quantity: number,
): Promise<void> {
  const cart = await openCart(scope, cartId);
  const line = (cart.items ?? []).find((item) => offerIdOf(item) === offerId);
  const wanted = Number(line?.quantity ?? 0) + quantity;
  const offer = await sellableOffer(scope, offerId, wanted);
  if (line) {
    await updateLineItemInCartWorkflow(scope).run({
      input: {
        cart_id: cartId,
        item_id: line.id,
        update: { quantity: wanted, unit_price: priceOf(offer) },
      },
    });
    return;
  }
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const identifier = await catalog.retrievePartIdentifier(
    offer.part_identifier_id,
    { relations: ['part', 'brand'] },
  );
  await addToCartWorkflow(scope).run({
    input: {
      cart_id: cartId,
      items: [
        {
          title: `${identifier.part.name} (${identifier.brand.name} ${identifier.value})`,
          quantity,
          unit_price: priceOf(offer),
          requires_shipping: false,
          metadata: offerLineMetadata(offer.id, identifier.id, {
            slug: partPageSlug(
              identifier.brand.slug,
              identifier.normalized_value,
            ),
            brand: identifier.brand.name,
            number: identifier.value,
            name: identifier.part.name,
          }),
        },
      ],
    },
  });
}

export async function addOffer(
  scope: MedusaContainer,
  cartId: string,
  offerId: string,
  quantity: number,
): Promise<OfferCart> {
  await putOffer(scope, cartId, offerId, quantity);
  return syncOfferCart(scope, cartId, true);
}

export async function createOfferCart(
  scope: MedusaContainer,
  {
    email,
    offer_id,
    quantity,
  }: { email?: string; offer_id?: string; quantity: number },
): Promise<OfferCart> {
  if (offer_id) {
    await sellableOffer(scope, offer_id, quantity);
  }
  const { result } = await createCartWorkflow(scope).run({
    input: { email, metadata: CASH_AT_PICKUP_METADATA },
  });
  if (offer_id) {
    await putOffer(scope, result.id, offer_id, quantity);
  }
  return syncOfferCart(scope, result.id, Boolean(offer_id));
}

export const readOfferCart = (
  scope: MedusaContainer,
  cartId: string,
): Promise<OfferCart> => syncOfferCart(scope, cartId);

export async function setOfferQuantity(
  scope: MedusaContainer,
  cartId: string,
  itemId: string,
  quantity: number,
): Promise<OfferCart> {
  const cart = await retrieveCart(scope, cartId);
  const line = (cart.items ?? []).find((item) => item.id === itemId);
  const offerId = line && offerIdOf(line);
  if (cart.completed_at || !line || !offerId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Cart ${cartId} has no line ${itemId}`,
    );
  }
  const offer = await sellableOffer(scope, offerId, quantity);
  await updateLineItemInCartWorkflow(scope).run({
    input: {
      cart_id: cartId,
      item_id: itemId,
      update: { quantity, unit_price: priceOf(offer) },
    },
  });
  return syncOfferCart(scope, cartId, true);
}

export async function checkoutRefusal(
  scope: MedusaContainer,
  items: OfferCartLineItem[],
): Promise<Exclude<
  CheckoutRefusal,
  'CONTACT_MISSING' | 'CART_CHANGED'
> | null> {
  const addonItems = items.filter((item) => kindOf(item));
  const offerItems = items.filter((item) => !kindOf(item));
  if (offerItems.some((item) => !offerIdOf(item))) {
    return 'OFFER_MISSING';
  }
  const live = await offersOf(scope, offerItems);
  for (const item of offerItems) {
    const offer = live.get(offerIdOf(item)!);
    if (!offer) {
      return 'OFFER_MISSING';
    }
    if (orderCap(offer) < Number(item.quantity)) {
      return 'OFFER_OUT_OF_STOCK';
    }
    if (!MathBN.eq(priceOf(offer), item.unit_price)) {
      return 'OFFER_PRICE_CHANGED';
    }
  }
  return addonRefusal(
    await servicesOf(scope, offerItems),
    addonItems,
    new Map(
      offerItems.map((item) => [offerIdOf(item)!, Number(item.quantity)]),
    ),
  );
}

const addonRefusal = (
  services: Map<string, LineServices>,
  addonItems: OfferCartLineItem[],
  quantities: Map<string, number>,
): 'OFFER_MISSING' | 'OFFER_PRICE_CHANGED' | null => {
  const keys = addonItems.map((item) =>
    addonKey(parentOfferIdOf(item), kindOf(item)),
  );
  for (const [index, item] of addonItems.entries()) {
    const parent = parentOfferIdOf(item);
    const price = parent ? priceFor(services.get(parent), kindOf(item)!) : null;
    if (parent === null || price === null) {
      return 'OFFER_MISSING';
    }
    if (
      keys.indexOf(keys[index]) !== index ||
      Number(item.quantity) !== quantities.get(parent) ||
      !MathBN.eq(price, item.unit_price)
    ) {
      return 'OFFER_PRICE_CHANGED';
    }
  }
  return null;
};
