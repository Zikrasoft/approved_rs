import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { ICartModuleService } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { completeCartWorkflow } from '@medusajs/medusa/core-flows';
import { vinSchema } from '@podbor/catalog-contract';

import { carLabel } from '../../../../../lib/order-lead';
import { vinDecoders } from '../../../../../lib/vin/chain';
import { resolveVin } from '../../../../../lib/vin/resolve';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import { VIN_LOOKUP_MODULE } from '../../../../../modules/vin-lookup';
import type { StoreCompleteOfferCartType } from '../../../validators';

async function carFor(
  scope: MedusaRequest['scope'],
  typed: string | undefined,
): Promise<string | undefined> {
  const vin = vinSchema.safeParse(typed);
  if (!vin.success) return undefined;
  const lookup = await resolveVin(vin.data, vinDecoders(scope), {
    catalog: scope.resolve(CATALOG_MODULE),
    vinLookups: scope.resolve(VIN_LOOKUP_MODULE),
  });
  return lookup.resolved ? carLabel(lookup.vehicle) : undefined;
}

export async function POST(
  req: MedusaRequest<StoreCompleteOfferCartType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const contact = req.validatedBody;
  const car = (await carFor(req.scope, contact.vin)) ?? contact.car;
  const carts: ICartModuleService = req.scope.resolve(Modules.CART);
  const cart = await carts.retrieveCart(id);
  await carts.updateCarts(id, {
    metadata: { ...cart.metadata, ...contact, ...(car && { car }) },
  });

  const { result } = await completeCartWorkflow(req.scope).run({
    input: { id },
  });

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [order],
  } = await query.graph({
    entity: 'order',
    filters: { id: result.id },
    fields: ['id', 'display_id'],
  });

  res.json({ order: { id: order.id, display_id: order.display_id } });
}
