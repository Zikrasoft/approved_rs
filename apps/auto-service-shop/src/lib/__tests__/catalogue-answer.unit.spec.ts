import { EventEmitter } from 'node:events';

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import {
  answerCataloguePage,
  CATALOGUE_PAGES_AT_ONCE,
} from '../catalogue-answer';

const request = (gone = false) =>
  ({
    headers: { 'x-catalogue-locale': 'sr' },
    scope: {
      resolve: () => ({
        client: {
          acquireConnection: async () => ({}),
          releaseConnection: async () => undefined,
        },
      }),
    },
    socket: { destroyed: gone },
  }) as unknown as MedusaRequest;

const response = () => {
  const sent: unknown[] = [];
  const res = Object.assign(new EventEmitter(), {
    json: (body: unknown) => sent.push(body),
  });
  return {
    sent,
    close: () => res.emit('close'),
    res: res as unknown as MedusaResponse,
  };
};

const page = z.object({ title: z.string() });

const deferred = () => {
  let release = () => {};
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { done, release };
};

describe('answerCataloguePage', () => {
  it('answers the page parsed by its contract, in the locale the header names', async () => {
    const { res, sent } = response();

    await answerCataloguePage(
      request(),
      res,
      page,
      'Part',
      async ({ locale }) => ({
        title: locale,
        extra: true,
      }),
    );

    expect(sent).toEqual([{ title: 'sr' }]);
  });

  it('answers 404 when there is no page', async () => {
    await expect(
      answerCataloguePage(
        request(),
        response().res,
        page,
        'Part',
        async () => null,
      ),
    ).rejects.toThrow('No such Part page');
  });

  it(`computes at most ${CATALOGUE_PAGES_AT_ONCE} pages at once and skips a page its caller left`, async () => {
    const gate = deferred();
    let running = 0;
    let peak = 0;
    const load = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await gate.done;
      running -= 1;
      return { title: 'x' };
    };
    const busy = Array.from({ length: CATALOGUE_PAGES_AT_ONCE + 2 }, () =>
      answerCataloguePage(request(), response().res, page, 'Part', load),
    );
    const left = response();
    const leftRequest = request();
    const abandoned = answerCataloguePage(
      leftRequest,
      left.res,
      page,
      'Part',
      load,
    );
    (leftRequest.socket as { destroyed: boolean }).destroyed = true;

    await new Promise((resolve) => setImmediate(resolve));
    expect(running).toBe(CATALOGUE_PAGES_AT_ONCE);
    gate.release();
    await Promise.all([...busy, abandoned]);

    expect(peak).toBe(CATALOGUE_PAGES_AT_ONCE);
    expect(left.sent).toEqual([]);
  });

  it('never computes a page whose caller left while it waited, and hands its turn on', async () => {
    const gate = deferred();
    const blocking = Array.from({ length: CATALOGUE_PAGES_AT_ONCE }, () =>
      answerCataloguePage(request(), response().res, page, 'Part', async () => {
        await gate.done;
        return { title: 'x' };
      }),
    );
    const left = response();
    let leftLoaded = false;
    const abandoned = answerCataloguePage(
      request(),
      left.res,
      page,
      'Part',
      async () => {
        leftLoaded = true;
        return { title: 'x' };
      },
    );
    left.close();
    await abandoned;

    gate.release();
    await Promise.all(blocking);
    const after = response();
    await answerCataloguePage(request(), after.res, page, 'Part', async () => ({
      title: 'next',
    }));

    expect(leftLoaded).toBe(false);
    expect(left.sent).toEqual([]);
    expect(after.sent).toEqual([{ title: 'next' }]);
  });
});
