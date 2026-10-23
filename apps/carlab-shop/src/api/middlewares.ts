import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http';

import {
  AdminAddPartIdentifier,
  AdminBulkAttachFitments,
  AdminBulkDetachFitments,
  AdminCreateBrand,
  AdminCreateBrandSpelling,
  AdminCreateCategory,
  AdminCreateCategoryField,
  AdminCreateCategoryFieldOption,
  AdminCreateFitment,
  AdminCreatePart,
  AdminCreateRequirement,
  AdminCreateSupplierCategory,
  AdminEditTranslation,
  AdminListFitments,
  AdminListPartIdentifiers,
  AdminListRequirements,
  AdminOrderImages,
  AdminSearchParts,
  AdminUpdateCategory,
  AdminUpdateCategoryField,
  AdminUpdateCategoryFieldOption,
  AdminUpdatePart,
  AdminUpdatePartIdentifier,
  AdminUpdateSupplier,
} from './admin/validators';
import { keepAdminCodes, validateAdminBody } from '../lib/admin-errors';
import { manualOfferSchema } from '../lib/suppliers/manual-offers';
import { refuseClosedShop, refuseStockCartChange } from '../lib/offer-cart';
import { VEHICLE_REFERENCE_BODIES } from './admin/vehicle-validators';
import {
  StoreAddLineAddon,
  StoreAddOfferCartItem,
  StoreCompleteOfferCart,
  StoreSetOfferCartItem,
  StoreCreateOfferCart,
  StoreCreateVinLookup,
  StoreListFitments,
  StoreListPartPages,
  StoreSearchParts,
  StoreVehicleParts,
} from './store/validators';

export default defineMiddlewares({
  errorHandler: keepAdminCodes,
  routes: [
    {
      matcher: '/admin/brands',
      method: 'POST',
      middlewares: [validateAdminBody(AdminCreateBrand)],
    },
    {
      matcher: '/admin/brands/:id/spellings',
      method: 'POST',
      middlewares: [validateAdminBody(AdminCreateBrandSpelling)],
    },
    {
      matcher: '/admin/categories',
      method: 'POST',
      middlewares: [validateAdminBody(AdminCreateCategory)],
    },
    {
      matcher: '/admin/categories/:id',
      method: 'POST',
      middlewares: [validateAdminBody(AdminUpdateCategory)],
    },
    {
      matcher: '/admin/categories/:id/fields',
      method: 'POST',
      middlewares: [validateAdminBody(AdminCreateCategoryField)],
    },
    {
      matcher: '/admin/categories/:id/fields/:field_id',
      method: 'POST',
      middlewares: [validateAdminBody(AdminUpdateCategoryField)],
    },
    {
      matcher: '/admin/categories/:id/fields/:field_id/options',
      method: 'POST',
      middlewares: [validateAdminBody(AdminCreateCategoryFieldOption)],
    },
    {
      matcher: '/admin/categories/:id/fields/:field_id/options/:option_id',
      method: 'POST',
      middlewares: [validateAdminBody(AdminUpdateCategoryFieldOption)],
    },
    {
      matcher: '/admin/parts',
      method: 'GET',
      middlewares: [validateAndTransformQuery(AdminSearchParts, {})],
    },
    {
      matcher: '/admin/parts',
      method: 'POST',
      middlewares: [validateAdminBody(AdminCreatePart)],
    },
    {
      matcher: '/admin/parts/:id',
      method: 'POST',
      middlewares: [validateAdminBody(AdminUpdatePart)],
    },
    {
      matcher: '/admin/part-identifiers/:id/images/order',
      method: 'POST',
      middlewares: [validateAdminBody(AdminOrderImages)],
    },
    {
      matcher: '/admin/parts/:id/identifiers',
      method: 'POST',
      middlewares: [validateAdminBody(AdminAddPartIdentifier)],
    },
    {
      matcher: '/admin/part-identifiers',
      method: 'GET',
      middlewares: [validateAndTransformQuery(AdminListPartIdentifiers, {})],
    },
    {
      matcher: '/admin/part-identifiers/:id',
      method: 'POST',
      middlewares: [validateAdminBody(AdminUpdatePartIdentifier)],
    },
    {
      matcher: '/admin/part-identifiers/:id/manual-offer',
      method: 'POST',
      middlewares: [validateAdminBody(manualOfferSchema)],
    },
    {
      matcher: '/admin/fitments',
      method: 'GET',
      middlewares: [validateAndTransformQuery(AdminListFitments, {})],
    },
    {
      matcher: '/admin/fitments',
      method: 'POST',
      middlewares: [validateAdminBody(AdminCreateFitment)],
    },
    {
      matcher: '/admin/fitments/bulk',
      method: 'POST',
      middlewares: [validateAdminBody(AdminBulkAttachFitments)],
    },
    {
      matcher: '/admin/fitments/bulk/delete',
      method: 'POST',
      middlewares: [validateAdminBody(AdminBulkDetachFitments)],
    },

    {
      matcher: '/admin/requirements',
      method: 'GET',
      middlewares: [validateAndTransformQuery(AdminListRequirements, {})],
    },
    {
      matcher: '/admin/requirements',
      method: 'POST',
      middlewares: [validateAdminBody(AdminCreateRequirement)],
    },
    {
      matcher: '/admin/translations/:entity/:id',
      method: 'POST',
      middlewares: [validateAdminBody(AdminEditTranslation)],
    },
    {
      matcher: '/admin/suppliers/:id',
      method: 'POST',
      middlewares: [validateAdminBody(AdminUpdateSupplier)],
    },
    {
      matcher: '/admin/suppliers/:id/categories',
      method: 'POST',
      middlewares: [validateAdminBody(AdminCreateSupplierCategory)],
    },
    ...VEHICLE_REFERENCE_BODIES.flatMap(([matcher, create, update]) => [
      {
        matcher,
        method: 'POST' as const,
        middlewares: [validateAdminBody(create)],
      },
      {
        matcher: `${matcher}/:id`,
        method: 'POST' as const,
        middlewares: [validateAdminBody(update)],
      },
    ]),
    ...[
      '/store/carts',
      '/store/carts/:id',
      '/store/carts/:id/line-items',
      '/store/carts/:id/line-items/:line_id',
      '/store/carts/:id/promotions',
      '/store/carts/:id/shipping-methods',
      '/store/carts/:id/customer',
      '/store/carts/:id/taxes',
    ].map((matcher) => ({
      matcher,
      method: ['POST' as const, 'DELETE' as const],
      middlewares: [refuseStockCartChange],
    })),
    {
      matcher: '/store/part-pages',
      method: 'GET',
      middlewares: [validateAndTransformQuery(StoreListPartPages, {})],
    },
    {
      matcher: '/store/fitments',
      method: 'GET',
      middlewares: [validateAndTransformQuery(StoreListFitments, {})],
    },
    {
      matcher: '/store/vehicles/:id/parts',
      method: 'GET',
      middlewares: [validateAndTransformQuery(StoreVehicleParts, {})],
    },
    {
      matcher: '/store/search',
      method: 'GET',
      middlewares: [validateAndTransformQuery(StoreSearchParts, {})],
    },
    {
      matcher: '/store/vin-lookups',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreCreateVinLookup)],
    },
    {
      matcher: '/store/offer-carts',
      method: 'POST',
      middlewares: [
        refuseClosedShop,
        validateAndTransformBody(StoreCreateOfferCart),
      ],
    },
    {
      matcher: '/store/offer-carts/:id/items',
      method: 'POST',
      middlewares: [
        refuseClosedShop,
        validateAndTransformBody(StoreAddOfferCartItem),
      ],
    },
    {
      matcher: '/store/offer-carts/:id/items/:item_id',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreSetOfferCartItem)],
    },
    {
      matcher: '/store/offer-carts/:id/items/:item_id/addon',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreAddLineAddon)],
    },
    {
      matcher: '/store/offer-carts/:id/complete',
      method: 'POST',
      middlewares: [
        refuseClosedShop,
        validateAndTransformBody(StoreCompleteOfferCart),
      ],
    },
  ],
});
