import { knex, type Knex } from '@medusajs/framework/mikro-orm/knex';
import { EventEmitter } from 'node:events';

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { MedusaContainer } from '@medusajs/framework/types';
import { z } from 'zod';

import { answerCataloguePage } from '../catalogue-answer';
import {
  clearCatalogueMemo,
  markCatalogueMemoStale,
  memoized,
} from '../catalogue-memo';

import { STORE_READ_TIMEOUT, storeRead } from '../store-read';

const timeout = async (db: Knex) =>
  (await db.raw('show statement_timeout')).rows[0].statement_timeout;

describe('A store read', () => {
  let db: Knex;
  let scope: MedusaContainer;

  beforeAll(() => {
    db = knex({
      client: 'pg',
      connection: process.env.DATABASE_URL!.replace(/\/medusa$/, '/postgres'),
      pool: { min: 0, max: 1 },
    });
    scope = { resolve: () => db } as unknown as MedusaContainer;
  });

  afterAll(() => db.destroy());

  it(`gives up on a statement after ${STORE_READ_TIMEOUT}, in a query or a transaction`, async () => {
    await storeRead(scope, async () => {
      expect(await timeout(db)).toBe(STORE_READ_TIMEOUT);
      await db.transaction(async (trx) => {
        expect(await timeout(trx)).toBe(STORE_READ_TIMEOUT);
      });
    });
  });

  it('leaves every other read on the same connection without a limit', async () => {
    await storeRead(scope, () => timeout(db));

    expect(await timeout(db)).toBe('0');
    await db.transaction(async (trx) => {
      expect(await timeout(trx)).toBe('0');
    });
  });

  it('leaves a shared catalogue memo it starts without a limit', async () => {
    clearCatalogueMemo();

    const first = await storeRead(scope, () =>
      memoized('timeout', () => timeout(db)),
    );
    markCatalogueMemoStale('timeout');
    let refreshed: Promise<string> = Promise.resolve('');
    await storeRead(scope, () =>
      memoized('timeout', () => (refreshed = timeout(db))),
    );

    expect(first).toBe('0');
    expect(await refreshed).toBe('0');
    clearCatalogueMemo();
  });

  it('wraps every catalogue page load', async () => {
    const sent: unknown[] = [];
    const res = Object.assign(new EventEmitter(), {
      json: (body: unknown) => sent.push(body),
    }) as unknown as MedusaResponse;
    const req = {
      headers: { 'x-catalogue-locale': 'sr' },
      scope,
      socket: { destroyed: false },
    } as unknown as MedusaRequest;

    await answerCataloguePage(
      req,
      res,
      z.object({ timeout: z.string() }),
      'Part',
      async () => ({ timeout: await timeout(db) }),
    );

    expect(sent).toEqual([{ timeout: STORE_READ_TIMEOUT }]);
  });
});
