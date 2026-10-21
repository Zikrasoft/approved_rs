import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http';

import {
  AdminClassifyPart,
  AdminCreateBrand,
  AdminCreateBrandSpelling,
  AdminCreateCategory,
  AdminCreateCategoryField,
  AdminCreateCategoryFieldOption,
  AdminCreateFitment,
  AdminCreatePart,
  AdminListFitments,
  AdminSearchParts,
  AdminUpdateCategory,
  AdminUpdateCategoryField,
  AdminUpdateCategoryFieldOption,
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
      matcher: '/admin/parts/:id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminClassifyPart)],
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
