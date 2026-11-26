import type { ExecArgs } from '@medusajs/framework/types';

import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';

export default async function buildCatalogueSnapshot({ container }: ExecArgs) {
  await container
    .resolve<PublishModuleService>(PUBLISH_MODULE)
    .buildCatalogueSnapshot();
}
