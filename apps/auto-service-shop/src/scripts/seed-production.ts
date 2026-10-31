import type { ExecArgs } from '@medusajs/framework/types';

import { seedProductionCatalogue } from '../lib/production-seed';

export default async function seedProduction({ container }: ExecArgs) {
  await seedProductionCatalogue(container);
}
