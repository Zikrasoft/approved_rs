import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http';

import {
  AdminCreateBrand,
  AdminCreateBrandSpelling,
  AdminCreateFitment,
  AdminCreatePart,
  AdminEditTranslation,
  AdminListFitments,
  AdminSearchParts,
  AdminUpdateSupplier,
} from './admin/validators';
import {
  StoreAddOfferCartItem,
  StoreCreateOfferCart,
  StoreCreateVinLookup,
  StoreListPartPages,
  StoreSearchParts,
} from './store/validators';

export default defineMiddlewares({
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
      matcher: '/store/part-pages',
      method: 'GET',
      middlewares: [validateAndTransformQuery(StoreListPartPages, {})],
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
  ],
});
