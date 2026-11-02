import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { DEMAND_MODULE } from '../../modules/demand';
import type DemandModuleService from '../../modules/demand/service';
import orderPlacedDemand, { config } from '../order-placed-demand';

medusaIntegrationTestRunner({
  moduleName: 'order-placed-demand',
  dbName: 'medusa-order-placed-demand-integration',
  testSuite: ({ getContainer }) => {
    describe('an order counting as demand', () => {
      const place = async (lines: Record<string, unknown>[]) => {
        const order = await getContainer()
          .resolve(Modules.ORDER)
          .createOrders({
            currency_code: 'rsd',
            items: lines.map((metadata, index) => ({
              title: `Line ${index}`,
              quantity: 2,
              unit_price: 1000,
              metadata,
            })),
          });
        return order.id;
      };
      const deliver = (id: string) =>
        orderPlacedDemand({
          event: { name: config.event, data: { id } },
          container: getContainer(),
        } as never);
      const demand = () =>
        getContainer()
          .resolve<DemandModuleService>(DEMAND_MODULE)
          .countsSince(new Date(Date.now() - 86_400_000));

      it('listens to placed orders', () => {
        expect(config.event).toBe('order.placed');
      });

      it('counts each ordered number once, leaving out add-ons and lines without a number, and a redelivery', async () => {
        const id = await place([
          { part_identifier_id: 'pi_ordered' },
          { part_identifier_id: 'pi_ordered' },
          {
            part_identifier_id: 'pi_installed',
            addon_offer_id: 'offer_1',
            addon_kind: 'service',
          },
          {},
        ]);

        await deliver(id);
        await deliver(id);

        expect(await demand()).toEqual([
          { id: 'pi_ordered', inquiries: 0, orders: 1, picks: 0 },
        ]);
      });
    });
  },
});
