import { model } from '@medusajs/framework/utils';

import { translatable } from './translatable';

const FitmentNote = model.define('fitment_note', {
  id: model.id().primaryKey(),
  note: model.text(),
  ...translatable(),
  updated_by: model.text().nullable(),
});

export default FitmentNote;
