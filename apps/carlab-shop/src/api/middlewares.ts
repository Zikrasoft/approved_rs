import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http';

import {
  AdminBulkAttachFitments,
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
  AdminListRequirements,
  AdminSearchParts,
  AdminUpdateCategory,
  AdminUpdateCategoryField,
  AdminUpdateCategoryFieldOption,
  AdminUpdatePart,
  AdminUpdatePartIdentifier,
  AdminUpdateSupplier,
} from './admin/validators';
import { keepConflictCodes } from '../lib/admin-errors';
import { VEHICLE_REFERENCE_BODIES } from './admin/vehicle-validators';
import {
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
  errorHandler: keepConflictCodes,
  routes: [
    {
      matcher: '/admin/brands',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreateBrand)],
    },
    {
      matcher: '/admin/brands/:id/spellings',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreateBrandSpelling)],
    },
    {
      matcher: '/admin/categories',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreateCategory)],
    },
    {
      matcher: '/admin/categories/:id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminUpdateCategory)],
    },
    {
      matcher: '/admin/categories/:id/fields',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreateCategoryField)],
    },
    {
      matcher: '/admin/categories/:id/fields/:field_id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminUpdateCategoryField)],
    },
    {
      matcher: '/admin/categories/:id/fields/:field_id/options',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreateCategoryFieldOption)],
    },
    {
      matcher: '/admin/categories/:id/fields/:field_id/options/:option_id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminUpdateCategoryFieldOption)],
    },
    {
      matcher: '/admin/parts',
      method: 'GET',
      middlewares: [validateAndTransformQuery(AdminSearchParts, {})],
    },
    {
      matcher: '/admin/parts',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreatePart)],
    },
    {
      matcher: '/admin/parts/:id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminUpdatePart)],
    },
    {
      matcher: '/admin/part-identifiers/:id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminUpdatePartIdentifier)],
    },
    {
      matcher: '/admin/fitments',
      method: 'GET',
      middlewares: [validateAndTransformQuery(AdminListFitments, {})],
    },
    {
      matcher: '/admin/fitments',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreateFitment)],
    },
    {
      matcher: '/admin/fitments/bulk',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminBulkAttachFitments)],
    },
    {
      matcher: '/admin/requirements',
      method: 'GET',
      middlewares: [validateAndTransformQuery(AdminListRequirements, {})],
    },
    {
      matcher: '/admin/requirements',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreateRequirement)],
    },
    {
      matcher: '/admin/translations/:entity/:id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminEditTranslation)],
    },
    {
      matcher: '/admin/suppliers/:id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminUpdateSupplier)],
    },
    {
      matcher: '/admin/suppliers/:id/categories',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreateSupplierCategory)],
    },
    ...VEHICLE_REFERENCE_BODIES.flatMap(([matcher, schema]) => [
      {
        matcher,
        method: 'POST' as const,
        middlewares: [validateAndTransformBody(schema)],
      },
      {
        matcher: `${matcher}/:id`,
        method: 'POST' as const,
        middlewares: [validateAndTransformBody(schema.partial())],
      },
    ]),
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
      middlewares: [validateAndTransformBody(StoreCreateOfferCart)],
    },
    {
      matcher: '/store/offer-carts/:id/items',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreAddOfferCartItem)],
    },
    {
      matcher: '/store/offer-carts/:id/items/:item_id',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreSetOfferCartItem)],
    },
    {
      matcher: '/store/offer-carts/:id/complete',
      method: 'POST',
      middlewares: [validateAndTransformBody(StoreCompleteOfferCart)],
    },
  ],
});
