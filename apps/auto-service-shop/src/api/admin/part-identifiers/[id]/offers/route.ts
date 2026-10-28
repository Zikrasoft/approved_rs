import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { withEditors } from '../../../../../lib/editors';
import { MANUAL_SUPPLIER } from '../../../../../lib/suppliers/manual-offers';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import { sellPrice } from '../../../../../modules/supplier/pricing';
import type SupplierModuleService from '../../../../../modules/supplier/service';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const identifier = await catalog.retrievePartIdentifier(req.params.id);
  const offers = await suppliers.listSupplierOffers(
    { part_identifier_id: identifier.id },
    { relations: ['supplier'], take: null, order: { created_at: 'ASC' } },
  );

  res.json({
    offers: await withEditors(
      req.scope,
      offers.map((offer) => ({
        id: offer.id,
        source: offer.supplier.name,
        manual: offer.supplier.name === MANUAL_SUPPLIER,
        cost_price: offer.cost_price,
        price: sellPrice(offer.cost_price, offer.supplier.markup_percentage),
        markup_percentage: offer.supplier.markup_percentage,
        currency: offer.currency,
        stock_quantity: offer.stock_quantity,
        lead_time_days: offer.lead_time_days,
        updated_at: new Date(offer.updated_at).toISOString(),
        updated_by: offer.updated_by,
      })),
    ),
  });
}
