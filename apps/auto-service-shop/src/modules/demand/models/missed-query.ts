import { model } from '@medusajs/framework/utils';

const MissedQuery = model
  .define('missed_query', {
    id: model.text().primaryKey(),
    query: model.text(),
    day: model.text(),
    count: model.number().default(0),
  })
  .indexes([{ on: ['day'] }]);

export default MissedQuery;
