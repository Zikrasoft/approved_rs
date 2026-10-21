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
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  deleteLineItemsWorkflow,
  updateLineItemInCartWorkflow,
} from '@medusajs/medusa/core-flows';
import {
  listedPartSchema,
  partPageSlug,
  type CheckoutRefusal,
  type OfferCart,
} from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { sellPrice } from '../modules/supplier/pricing';
import { liveOffers } from './suppliers/live-quote';

export const CASH_AT_PICKUP_PROVIDER_ID = 'pp_system_default';
export const CASH_AT_PICKUP_METADATA = { fulfillment: 'cash_at_pickup' };
export const OFFER_ID_METADATA_KEY = 'offer_id';

export type OfferCartLineItem = {
  id: string;
  title?: string;
  quantity: BigNumberValue;
  unit_price: BigNumberValue;
  metadata?: Record<string, unknown> | null;
};

export function offerIdOf(item: OfferCartLineItem): string | undefined {
  const offerId = item.metadata?.[OFFER_ID_METADATA_KEY];
  return typeof offerId === 'string' && offerId ? offerId : undefined;
}

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

export async function ensureCashAtPickupPaymentSession(
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

export async function syncOfferCart(
  scope: MedusaContainer,
  cartId: string,
  changed = false,
): Promise<OfferCart> {
  const cart = await retrieveCart(scope, cartId);
  const currency = cart.currency_code.toUpperCase();
  if (cart.completed_at) {
    return { id: cart.id, completed: true, currency, total: 0, items: [] };
  }
  const items = cart.items ?? [];
  const live = await offersOf(scope, items);
  let repriced = changed;
  const lines: OfferCart['items'] = [];
  for (const item of items) {
    const offerId = offerIdOf(item);
    if (!offerId) {
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
    lines.push({
      id: item.id,
      offer_id: offerId,
      quantity,
      unit_price: unitPrice,
      available: !!offer && offer.stock_quantity >= quantity,
      part: listedPartSchema
        .catch({ slug: '', brand: '', number: '', name: item.title })
        .parse(item.metadata),
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
      (sum, line) => sum + line.unit_price * line.quantity,
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
): Promise<void> {
  const cart = await openCart(scope, cartId);
  if (!(cart.items ?? []).some((item) => item.id === itemId)) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Cart ${cartId} has no line ${itemId}`,
    );
  }
  await deleteLineItemsWorkflow(scope).run({
    input: { cart_id: cartId, ids: [itemId] },
  });
}

export async function sellableOffer(
  scope: MedusaContainer,
  offerId: string,
  quantity: number,
) {
  const [offer] = await liveOffers(scope, { id: [offerId] });
  if (!offer) {
    return refuse('OFFER_MISSING', `Offer ${offerId} cannot be sold now`);
  }
  if (offer.stock_quantity < quantity) {
    return refuse('OFFER_OUT_OF_STOCK', `Only ${offer.stock_quantity} left`);
  }
  return offer;
}

export async function addOffer(
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
          metadata: {
            [OFFER_ID_METADATA_KEY]: offer.id,
            part_identifier_id: identifier.id,
            slug: partPageSlug(
              identifier.brand.slug,
              identifier.normalized_value,
            ),
            brand: identifier.brand.name,
            number: identifier.value,
            name: identifier.part.name,
          },
        },
      ],
    },
  });
}

export async function setOfferQuantity(
  scope: MedusaContainer,
  cartId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const cart = await retrieveCart(scope, cartId);
  const line = (cart.items ?? []).find((item) => item.id === itemId);
  const offerId = line && offerIdOf(line);
  if (cart.completed_at || !line || !offerId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Cart ${cartId} has no line ${itemId}`,
    );
  }
  const [offer] = await liveOffers(scope, { id: [offerId] });
  if (!offer) {
    return refuse('OFFER_MISSING', `Offer ${offerId} cannot be sold now`);
  }
  if (offer.stock_quantity < quantity) {
    return refuse('OFFER_OUT_OF_STOCK', `Only ${offer.stock_quantity} left`);
  }
  await updateLineItemInCartWorkflow(scope).run({
    input: {
      cart_id: cartId,
      item_id: itemId,
      update: { quantity, unit_price: priceOf(offer) },
    },
  });
}

export async function checkoutRefusal(
  scope: MedusaContainer,
  items: OfferCartLineItem[],
): Promise<Exclude<
  CheckoutRefusal,
  'CONTACT_MISSING' | 'CART_CHANGED'
> | null> {
  if (items.some((item) => !offerIdOf(item))) {
    return 'OFFER_MISSING';
  }
  const live = await offersOf(scope, items);
  for (const item of items) {
    const offer = live.get(offerIdOf(item)!);
    if (!offer) {
      return 'OFFER_MISSING';
    }
    if (offer.stock_quantity < Number(item.quantity)) {
      return 'OFFER_OUT_OF_STOCK';
    }
    if (!MathBN.eq(priceOf(offer), item.unit_price)) {
      return 'OFFER_PRICE_CHANGED';
    }
  }
  return null;
}
