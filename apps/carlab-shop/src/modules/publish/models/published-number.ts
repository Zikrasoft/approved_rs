import { model } from '@medusajs/framework/utils';

const PublishedNumber = model.define('published_number', {
  id: model.text().primaryKey(),
});

export default PublishedNumber;
