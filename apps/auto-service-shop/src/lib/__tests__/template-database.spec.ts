import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { Client } from '@medusajs/framework/pg';
import type { Knex } from '@medusajs/framework/mikro-orm/knex';

import linkFitmentNotesOnce from '../../migration-scripts/link-fitment-notes';
import orderTimeIndexes from '../../migration-scripts/order-time-indexes';
import { schemaProblems } from '../schema-check';
import {
  cloneTemplate,
  dropDatabase,
  suiteDatabaseName,
} from '../../../integration-tests/template-database';

const loadedAt = new Date();

medusaIntegrationTestRunner({
  moduleName: 'template_database',
  testSuite: ({ getContainer, api, dbConfig }) => {
    const pg = (): Knex =>
      getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION);

    it('starts on a database the migrations built before the suite loaded', async () => {
      const { rows } = await pg().raw(
        'select max(executed_at) as last from mikro_orm_migrations',
      );
      expect(rows[0].last.getTime()).toBeLessThan(loadedAt.getTime());
      await orderTimeIndexes({ container: getContainer() });
      await linkFitmentNotesOnce({ container: getContainer() });
      expect(await schemaProblems(pg())).toEqual([]);
      const links = await pg().raw(
        'select count(*)::int as n from link_module_migrations',
      );
      expect(links.rows[0].n).toBeGreaterThan(0);
    });

    it('keeps what it writes out of the next suite database', async () => {
      await pg().raw(
        `insert into crawl_run (site, status, started_at) values ('template-probe', 'running', now())`,
      );
      const next = 'medusa-template-probe-next-suite';
      await cloneTemplate(next);
      const client = new Client({
        connectionString: dbConfig.clientUrl.replace(dbConfig.dbName, next),
      });
      await client.connect();
      try {
        const { rows } = await client.query(
          `select count(*)::int as n from crawl_run where site = 'template-probe'`,
        );
        expect(rows[0].n).toBe(0);
      } finally {
        await client.end();
        await dropDatabase(next);
      }
    });

    it('gives each jest worker its own database', () => {
      expect(suiteDatabaseName({ moduleName: 'catalog' }, '1')).not.toBe(
        suiteDatabaseName({ moduleName: 'catalog' }, '2'),
      );
    });

    it('lets the server take a free port instead of a pinned one', async () => {
      expect(process.env.PORT).toBeUndefined();
      const { status } = await api.get('/health');
      expect(status).toBe(200);
    });
  },
});
