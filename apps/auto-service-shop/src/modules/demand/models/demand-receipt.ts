import { model } from '@medusajs/framework/utils';

const DemandReceipt = model
  .define('demand_receipt', {
    id: model.text().primaryKey(),
    day: model.text(),
  })
  .indexes([{ on: ['day'] }]);

export default DemandReceipt;
