import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { DEMAND_MODULE } from '..';
import type DemandModuleService from '../service';

const AT = new Date('2026-11-02T10:00:00Z');
const DAY_MS = 86_400_000;
const daysBefore = (days: number) => new Date(AT.getTime() - days * DAY_MS);

medusaIntegrationTestRunner({
  moduleName: 'demand_module',
  dbName: 'medusa-demand-module-integration',
  testSuite: ({ getContainer }) => {
    describe('The demand module', () => {
      let demand: DemandModuleService;

      beforeAll(() => {
        demand = getContainer().resolve(DEMAND_MODULE);
      });

      it('counts each signal once per number, however often a submission names it', async () => {
        await demand.record({
          signal: 'inquiry',
          identifierIds: ['pi_a', 'pi_a', 'pi_b'],
          at: AT,
        });
        await demand.record({
          signal: 'inquiry',
          identifierIds: ['pi_a'],
          at: AT,
        });
        await demand.record({
          signal: 'order',
          identifierIds: ['pi_a'],
          at: AT,
        });
        await demand.record({
          signal: 'pick',
          identifierIds: ['pi_b'],
          at: AT,
        });

        expect(
          (await demand.countsSince(AT)).sort((a, b) =>
            a.id.localeCompare(b.id),
          ),
        ).toEqual([
          { id: 'pi_a', inquiries: 2, orders: 1, picks: 0 },
          { id: 'pi_b', inquiries: 1, orders: 0, picks: 1 },
        ]);
      });

      it('counts a keyed signal once, so a retried delivery does not count twice', async () => {
        const order = {
          signal: 'order' as const,
          identifierIds: ['pi_c'],
          key: 'order:order_1',
          at: AT,
        };

        expect(await demand.record(order)).toBe(true);
        expect(await demand.record(order)).toBe(false);
        expect(await demand.record({ ...order, key: 'order:order_2' })).toBe(
          true,
        );

        expect(
          (await demand.countsSince(AT)).find(({ id }) => id === 'pi_c'),
        ).toEqual({ id: 'pi_c', inquiries: 0, orders: 2, picks: 0 });
      });

      it('records nothing for a submission that names no number', async () => {
        expect(
          await demand.record({
            signal: 'pick',
            identifierIds: [],
            key: 'x',
            at: AT,
          }),
        ).toBe(false);
        expect(
          await demand.record({
            signal: 'pick',
            identifierIds: ['pi_x'],
            key: 'x',
            at: AT,
          }),
        ).toBe(true);
      });

      it('sums the days of a window and leaves out the days before it', async () => {
        await demand.record({
          signal: 'inquiry',
          identifierIds: ['pi_d'],
          at: daysBefore(5),
        });
        await demand.record({
          signal: 'inquiry',
          identifierIds: ['pi_d'],
          at: daysBefore(1),
        });
        await demand.record({
          signal: 'inquiry',
          identifierIds: ['pi_e'],
          at: daysBefore(10),
        });

        const counted = await demand.countsSince(daysBefore(5));
        expect(counted.find(({ id }) => id === 'pi_d')?.inquiries).toBe(2);
        expect(counted.find(({ id }) => id === 'pi_e')).toBeUndefined();
      });

      it('ranks the queries that found nothing by how often they were asked', async () => {
        await demand.recordMissedQuery('k&n 33-2304', { at: AT });
        await demand.recordMissedQuery('k&n 33-2304', { at: daysBefore(1) });
        await demand.recordMissedQuery('mann c 37 001', { at: AT });
        await demand.recordMissedQuery('old query', { at: daysBefore(40) });

        expect(await demand.missedQueriesSince(daysBefore(30), 10)).toEqual([
          { query: 'k&n 33-2304', count: 2 },
          { query: 'mann c 37 001', count: 1 },
        ]);
        expect(await demand.missedQueriesSince(daysBefore(30), 1)).toHaveLength(
          1,
        );
      });

      it('counts a visitor repeating a missed query once a day', async () => {
        const visitorId = '2b1f0c4e-8f5a-4d7b-9c3e-1a2b3c4d5e6f';
        await demand.recordMissedQuery('hu 816', { visitorId, at: AT });
        await demand.recordMissedQuery('hu 816', { visitorId, at: AT });
        await demand.recordMissedQuery('hu 816', {
          visitorId,
          at: daysBefore(1),
        });
        await demand.recordMissedQuery('hu 816', { at: AT });
        await demand.recordMissedQuery('hu 816', { at: AT });

        expect(await demand.missedQueriesSince(daysBefore(30), 10)).toEqual([
          { query: 'hu 816', count: 4 },
        ]);
      });

      it('forgets the days, receipts and missed queries older than a cutoff', async () => {
        await demand.record({
          signal: 'order',
          identifierIds: ['pi_old'],
          key: 'order:old',
          at: daysBefore(200),
        });
        await demand.recordMissedQuery('forgotten', { at: daysBefore(200) });

        expect(await demand.pruneBefore(daysBefore(150))).toBe(3);

        expect(
          (await demand.countsSince(daysBefore(365))).find(
            ({ id }) => id === 'pi_old',
          ),
        ).toBeUndefined();
        expect(
          await demand.record({
            signal: 'order',
            identifierIds: ['pi_old'],
            key: 'order:old',
            at: AT,
          }),
        ).toBe(true);
      });
    });
  },
});
