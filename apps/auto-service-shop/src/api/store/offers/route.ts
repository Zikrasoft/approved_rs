import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { identifierOffersResponseSchema } from '@podbor/catalog-contract';

import { installationPrice } from '../../../lib/installation';
import { pricesShown } from '../../../lib/shop-gate';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
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
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const shown = pricesShown(req);
  const [offers, identifiers] = shown
    ? await Promise.all([
        suppliers.listSupplierOffers(
          { part_identifier_id: ids },
          { relations: ['supplier'], take: null },
        ),
        catalog.listPartIdentifiers(
          { id: ids },
          { relations: ['part', 'part.category'], take: null },
        ),
      ])
    : [[], []];
  const installation = new Map(
    identifiers.map(({ id, part }) => [id, installationPrice(part)]),
  );

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
      installation: Object.fromEntries(
        ids.map((id) => [id, installation.get(id) ?? null]),
      ),
    }),
  );
}
