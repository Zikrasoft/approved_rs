import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { SUPPLIER_MODULE } from '..';
import type SupplierModuleService from '../service';

medusaIntegrationTestRunner({
  moduleName: 'supplier_upserts',
  testSuite: ({ getContainer }) => {
    describe('Supplier offer and staged record upserts', () => {
      let suppliers: SupplierModuleService;
      let supplierId: string;

      const offer = (article: string, cost_price: number) => ({
        supplier_id: supplierId,
        supplier_article_id: article,
        part_identifier_id: 'pid_1',
        cost_price,
        stock_quantity: 3,
        lead_time_days: 0,
      });

      const staged = (
        kind: 'cross_references' | 'images',
        items: string[],
      ) => ({
        supplier_id: supplierId,
        part_identifier_id: 'pid_1',
        kind,
        payload: { items },
      });

      beforeAll(async () => {
        suppliers = getContainer().resolve(SUPPLIER_MODULE);
        supplierId = (
          await suppliers.createSuppliers({
            name: 'Upserts',
            markup_percentage: 10,
          })
        ).id;
      });

      it('creates an offer, then updates it under the same article, keeping its author', async () => {
        const created = await suppliers.upsertSupplierOffer({
          ...offer('A-1', 100),
          created_by: 'user_a',
          updated_by: 'user_a',
        });
        const updated = await suppliers.upsertSupplierOffer({
          ...offer('A-1', 150),
          created_by: 'user_b',
          updated_by: 'user_b',
        });

        expect(updated.id).toBe(created.id);
        const rows = await suppliers.listSupplierOffers({
          supplier_article_id: 'A-1',
        });
        expect(rows).toEqual([
          expect.objectContaining({
            cost_price: 150,
            created_by: 'user_a',
            updated_by: 'user_b',
          }),
        ]);
      });

      it('resolves writers racing on one article to a single offer', async () => {
        await Promise.all(
          [100, 110, 120, 130].map((price) =>
            suppliers.upsertSupplierOffer(offer('A-2', price)),
          ),
        );

        expect(
          await suppliers.listSupplierOffers({ supplier_article_id: 'A-2' }),
        ).toHaveLength(1);
      });

      it('creates a staged record, then replaces its payload', async () => {
        const created = await suppliers.upsertStagedRecord(
          staged('cross_references', ['111']),
        );
        const updated = await suppliers.upsertStagedRecord(
          staged('cross_references', ['222']),
        );

        expect(updated.id).toBe(created.id);
        expect(
          await suppliers.listStagedRecords({ kind: 'cross_references' }),
        ).toEqual([expect.objectContaining({ payload: { items: ['222'] } })]);
      });

      it('resolves writers racing on one staged record to a single row', async () => {
        await Promise.all(
          ['1', '2', '3', '4'].map((item) =>
            suppliers.upsertStagedRecord(staged('images', [item])),
          ),
        );

        expect(
          await suppliers.listStagedRecords({ kind: 'images' }),
        ).toHaveLength(1);
      });
    });
  },
});
