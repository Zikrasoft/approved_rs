import type { Knex } from '@medusajs/framework/mikro-orm/knex';
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';

export default async function buildCatalogueSnapshot({ container }: ExecArgs) {
  const pg = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows } = await pg.raw(
    'select exists(select 1 from listed_series_part) as built',
  );
  if (!rows[0].built) {
    await container
      .resolve<PublishModuleService>(PUBLISH_MODULE)
      .buildCatalogueSnapshot();
  }
}
