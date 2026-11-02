import { model } from '@medusajs/framework/utils';

const PartDemandDay = model
  .define('part_demand_day', {
    id: model.text().primaryKey(),
    part_identifier_id: model.text(),
    day: model.text(),
    inquiries: model.number().default(0),
    orders: model.number().default(0),
    picks: model.number().default(0),
  })
  .indexes([{ on: ['day'] }]);

export default PartDemandDay;
