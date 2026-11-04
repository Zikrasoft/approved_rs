import { model } from '@medusajs/framework/utils';

export const translatable = () => ({
  translations: model.json().nullable(),
  translated_from: model.json().nullable(),
});
