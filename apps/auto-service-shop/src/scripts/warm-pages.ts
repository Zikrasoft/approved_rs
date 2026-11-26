import type { ExecArgs } from '@medusajs/framework/types';

import { prewarmCatalogue } from '../lib/publish/prewarm-run';

export default async function warmPages({ container }: ExecArgs) {
  const result = await prewarmCatalogue(container);
  console.log(
    result
      ? `Warmed ${result.warmed} pages, ${result.failed} failed.`
      : 'Nothing warmed: STOREFRONT_ORIGIN is unset or the page list failed.',
  );
}
