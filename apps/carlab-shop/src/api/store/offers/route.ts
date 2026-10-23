import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { identifierOffersResponseSchema } from '@podbor/catalog-contract';

import { pricesShown } from '../../../lib/offer-cart';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import { storeOffers } from '../../../modules/supplier/pricing';
import type SupplierModuleService from '../../../modules/supplier/service';
import type { StoreListOffersType } from '../validators';

export async function GET(
  req: MedusaRequest<unknown, StoreListOffersType>,
  res: MedusaResponse,
): Promise<void> {
  const { part_identifier_id: ids } = req.validatedQuery as StoreListOffersType;
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const offers = pricesShown(req)
    ? await suppliers.listSupplierOffers(
        { part_identifier_id: ids },
        { relations: ['supplier'], take: null },
      )
    : [];

  res.json(
    identifierOffersResponseSchema.parse({
      offers: Object.fromEntries(
        ids.map((id) => [
          id,
          storeOffers(
            offers.filter((offer) => offer.part_identifier_id === id),
          ),
        ]),
      ),
    }),
  );
}
