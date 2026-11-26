import type { MedusaContainer } from '@medusajs/framework/types';

import { cataloguePageList } from '../catalogue-page-list';
import { parseEnv } from '../env';
import { logEvent } from '../log-event';
import { warmCataloguePages, type WarmResult } from './prewarm';

export const PUBLISH_PREWARM_REGISTRATION = 'publishPrewarm';

export type PublishPrewarm = () => Promise<unknown>;

export async function prewarmCatalogue(
  scope: MedusaContainer,
): Promise<WarmResult | null> {
  const origin = parseEnv(process.env).STOREFRONT_ORIGIN;
  if (!origin) return null;
  try {
    const result = await warmCataloguePages(
      origin,
      await cataloguePageList(scope),
    );
    logEvent('catalogue.prewarm', result);
    return result;
  } catch {
    return null;
  }
}
