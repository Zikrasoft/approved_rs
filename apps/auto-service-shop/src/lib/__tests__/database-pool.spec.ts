import { knex } from '@medusajs/framework/mikro-orm/knex';

import { withoutJit } from '../database-pool';

describe('The shop database URL', () => {
  it('opens connections without JIT, which costs a catalogue query a second to compile', async () => {
    const db = knex({
      client: 'pg',
      connection: withoutJit(
        process.env.DATABASE_URL!.replace(/\/medusa$/, '/postgres'),
      ),
      pool: { min: 0, max: 1 },
    });
    try {
      expect((await db.raw('show jit')).rows).toEqual([{ jit: 'off' }]);
    } finally {
      await db.destroy();
    }
  });

  it('keeps the options the URL already carries', () => {
    expect(withoutJit('postgres://shop@db:5432/carlab?sslmode=require')).toBe(
      'postgres://shop@db:5432/carlab?sslmode=require&options=-c+jit%3Doff',
    );
  });
});
