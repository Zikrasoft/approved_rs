import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import {
  CATALOGUE_LOCALE_HEADER,
  catalogueLocaleSchema,
  type CatalogLocale,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { pricesShown } from './shop-gate';
import { storeRead } from './store-read';

export const CATALOGUE_PAGES_AT_ONCE = 4;

let running = 0;
const waiting: (() => void)[] = [];

const turn = () =>
  running < CATALOGUE_PAGES_AT_ONCE
    ? (running++, Promise.resolve())
    : new Promise<void>((resolve) => waiting.push(resolve));

const done = () => {
  const next = waiting.shift();
  if (next) next();
  else running--;
};

const closed = (res: MedusaResponse) =>
  new Promise<'closed'>((resolve) =>
    res.once('close', () => resolve('closed')),
  );

const pageNumberSchema = z.coerce.number().int().positive().catch(0);

export const requestedPage = (req: MedusaRequest): number =>
  pageNumberSchema.parse(req.query.page ?? 1);

export type PageRequest = { locale: CatalogLocale; shown: boolean };

export async function answerCataloguePage<T>(
  req: MedusaRequest,
  res: MedusaResponse,
  schema: z.ZodType<T>,
  label: string,
  load: (page: PageRequest) => Promise<unknown>,
): Promise<void> {
  const taken = turn();
  if ((await Promise.race([taken, closed(res)])) === 'closed') {
    void taken.then(done);
    return;
  }
  try {
    if (req.socket?.destroyed) return;
    const page = await storeRead(req.scope, () =>
      load({
        locale: catalogueLocaleSchema.parse(
          req.headers[CATALOGUE_LOCALE_HEADER],
        ),
        shown: pricesShown(req),
      }),
    );
    if (!page) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No such ${label} page`,
      );
    }
    res.json(schema.parse(page));
  } finally {
    done();
  }
}
