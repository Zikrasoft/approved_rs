import type {
  ICartModuleService,
  ILockingModule,
  MedusaContainer,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils';
import {
  addToCartWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  deleteLineItemsWorkflow,
  updateLineItemInCartWorkflow,
} from '@medusajs/medusa/core-flows';
import {
  CATALOG_TRANSLATION_LOCALES,
  cartFingerprint,
  cartTotals,
  checkoutContactSchema,
  orderCap,
  partPageSlug,
  translationsSchema,
  type AddonKind,
  type CheckoutRefusal,
  type OfferCart,
} from '@podbor/catalog-contract';
import { PARTS_ORDER_COPY } from '@podbor/lead-crm/parts-order-copy';

import { z } from 'zod';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import {
  checkoutRefusal,
  planCart,
  priceFor,
  type AddonPrices,
  type CartItem,
  type CartRefusal,
  type Quote,
} from './cart-plan';
import {
  CASH_AT_PICKUP_METADATA,
  CASH_AT_PICKUP_PROVIDER_ID,
} from './commerce-defaults';
import { installationPrice } from './installation';
import {
  addonLineMetadata,
  offerLineMetadata,
  offerLineTitle,
  withParentOffers,
  readLine,
} from './line-metadata';
import { sellingOffers } from './suppliers/live-quote';
import { carFor } from './vin/car-for';

type OfferCartLineItem = CartItem;

const offerIdOf = (item: OfferCartLineItem) =>
  readLine(item.metadata).offerId ?? undefined;

const parentOfferIdOf = (item: OfferCartLineItem) =>
  readLine(item.metadata).parentOfferId;

const kindOf = (item: OfferCartLineItem) => readLine(item.metadata).addonKind;

type CategoryAddon = NonNullable<AddonPrices['service']>;

type ServiceCategory = {
  service_label: string | null;
  service_price: number | null;
  translations: unknown;
};

const addonLabelTranslations = ({
  translations,
}: ServiceCategory): CategoryAddon['translations'] => {
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

const servicesOf = async (
  scope: MedusaContainer,
  items: OfferCartLineItem[],
): Promise<Map<string, AddonPrices>> => {
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

export const refuse = (code: CheckoutRefusal, message: string): never => {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message, code);
};

const quotesOf = async (
  scope: MedusaContainer,
  items: OfferCartLineItem[],
): Promise<Map<string, Quote>> => {
  const ids = items.map(offerIdOf).filter((id) => id !== undefined);
  const offers = ids.length ? await sellingOffers(scope, { id: ids }) : [];
  return new Map(offers.map((offer) => [offer.id, offer]));
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

const retrieveCart = async (scope: MedusaContainer, cartId: string) => {
  const cart = await scope
    .resolve<ICartModuleService>(Modules.CART)
    .retrieveCart(cartId, { relations: ['items'] });
  return { ...cart, items: withParentOffers(cart.items ?? []) };
};

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
  const { lines, fixes, stamps } = planCart(
    items,
    await quotesOf(scope, items),
    await servicesOf(scope, items),
  );
  if (fixes.remove.length) {
    await deleteLineItemsWorkflow(scope).run({
      input: { cart_id: cartId, ids: fixes.remove.map(({ itemId }) => itemId) },
    });
  }
  for (const { itemId, update } of fixes.update) {
    await updateLineItemInCartWorkflow(scope).run({
      input: { cart_id: cartId, item_id: itemId, update },
    });
  }
  for (const { itemId, metadata } of stamps) {
    await scope
      .resolve<ICartModuleService>(Modules.CART)
      .updateLineItems(itemId, { metadata });
  }
  if ((changed || fixes.remove.length || fixes.update.length) && items.length) {
    await ensureCashAtPickupPaymentSession(scope, cartId);
  }
  return {
    id: cart.id,
    completed: false,
    currency,
    total: cartTotals(lines).total,
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

const CART_LOCK_TIMEOUT_SECONDS = 30;

const locked =
  <Args extends unknown[], T>(
    job: (scope: MedusaContainer, cartId: string, ...args: Args) => Promise<T>,
  ) =>
  (scope: MedusaContainer, cartId: string, ...args: Args): Promise<T> =>
    scope
      .resolve<ILockingModule>(Modules.LOCKING)
      .execute(`offer-cart:${cartId}`, () => job(scope, cartId, ...args), {
        timeout: CART_LOCK_TIMEOUT_SECONDS,
      });

export const removeOfferLine = locked(
  async (scope, cartId, itemId: string): Promise<OfferCart> => {
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
  },
);

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

export const addLineAddon = locked(
  async (
    scope,
    cartId,
    itemId: string,
    kind: AddonKind = 'service',
  ): Promise<OfferCart> => {
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
                kind === 'installation'
                  ? PARTS_ORDER_COPY.installation
                  : lineServices!.service!.label,
              quantity: Number(line.quantity),
              unit_price: price,
              requires_shipping: false,
              metadata: addonLineMetadata({ lineId: line.id, offerId }, kind),
            },
          ],
        },
      });
    }
    return syncOfferCart(scope, cartId, true);
  },
);

export const removeLineAddon = locked(
  async (
    scope,
    cartId,
    itemId: string,
    kind: AddonKind = 'service',
  ): Promise<OfferCart> => {
    const { addonLines } = await offerLine(scope, cartId, itemId, kind);
    if (addonLines.length) {
      await deleteLineItemsWorkflow(scope).run({
        input: { cart_id: cartId, ids: addonLines.map(({ id }) => id) },
      });
    }
    return syncOfferCart(scope, cartId, true);
  },
);

async function sellableOffer(
  scope: MedusaContainer,
  offerId: string,
  quantity: number,
) {
  const [offer] = await sellingOffers(scope, { id: [offerId] });
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
        update: { quantity: wanted, unit_price: offer.price },
      },
    });
    return;
  }
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const identifier = await catalog.retrievePartIdentifier(
    offer.part_identifier_id,
    { relations: ['part', 'brand'] },
  );
  const part = {
    slug: partPageSlug(identifier.brand.slug, identifier.normalized_value),
    brand: identifier.brand.name,
    number: identifier.value,
    name: identifier.part.name,
  };
  await addToCartWorkflow(scope).run({
    input: {
      cart_id: cartId,
      items: [
        {
          title: offerLineTitle(part),
          quantity,
          unit_price: offer.price,
          requires_shipping: false,
          metadata: offerLineMetadata(
            offer.id,
            identifier.id,
            part,
            offer.supplier.name,
          ),
        },
      ],
    },
  });
}

export const addOffer = locked(
  async (
    scope,
    cartId,
    offerId: string,
    quantity: number,
  ): Promise<OfferCart> => {
    await putOffer(scope, cartId, offerId, quantity);
    return syncOfferCart(scope, cartId, true);
  },
);

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

export const readOfferCart = locked((scope, cartId) =>
  syncOfferCart(scope, cartId),
);

export const setOfferQuantity = locked(
  async (
    scope,
    cartId,
    itemId: string,
    quantity: number,
  ): Promise<OfferCart> => {
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
        update: { quantity, unit_price: offer.price },
      },
    });
    return syncOfferCart(scope, cartId, true);
  },
);

const REFUSAL_MESSAGES: Record<CartRefusal, string> = {
  OFFER_MISSING: 'A line in the cart has no offer that can be sold now.',
  OFFER_OUT_OF_STOCK: 'The supplier no longer has enough of a line in stock.',
  OFFER_PRICE_CHANGED:
    'The price changed for a line in the cart. Reprice the cart before completing checkout.',
};

export async function refuseCheckout(
  scope: MedusaContainer,
  cart: { metadata?: Record<string, unknown> | null; items?: unknown[] | null },
): Promise<void> {
  if (!checkoutContactSchema.safeParse(cart.metadata ?? {}).success) {
    refuse('CONTACT_MISSING', 'The order has no contact.');
  }
  const items = (cart.items ?? []) as OfferCartLineItem[];
  const offerItems = items.filter((item) => !kindOf(item));
  const refusal = checkoutRefusal(
    planCart(
      items,
      await quotesOf(scope, offerItems),
      await servicesOf(scope, offerItems),
    ),
  );
  if (refusal) {
    refuse(refusal, REFUSAL_MESSAGES[refusal]);
  }
}

export const checkout = locked(
  async (
    scope,
    cartId,
    {
      contact,
      fingerprint,
    }: { contact: z.output<typeof checkoutContactSchema>; fingerprint: string },
  ): Promise<{ id: string; display_id: number }> => {
    const cart = await retrieveCart(scope, cartId);
    const current = cartFingerprint(
      (cart.items ?? []).map((item) => ({
        id: item.id,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
    );
    if (fingerprint !== current) {
      refuse('CART_CHANGED', 'The cart changed since it was shown.');
    }
    if (!cart.completed_at) {
      const car = await carFor(scope, contact.vin);
      await scope
        .resolve<ICartModuleService>(Modules.CART)
        .updateCarts(cartId, {
          metadata: { ...cart.metadata, ...contact, car },
        });
    }
    const { result } = await completeCartWorkflow(scope).run({
      input: { id: cartId },
    });
    const {
      data: [order],
    } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: 'order',
      filters: { id: result.id },
      fields: ['id', 'display_id'],
    });
    return { id: order.id, display_id: Number(order.display_id) };
  },
);
