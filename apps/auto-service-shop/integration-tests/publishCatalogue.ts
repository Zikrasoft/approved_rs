import type { MedusaContainer } from '@medusajs/framework/types';

import { PUBLISH_MODULE } from '../src/modules/publish';
import type PublishModuleService from '../src/modules/publish/service';

export async function publishCatalogue(container: MedusaContainer) {
  const publish = container.resolve<PublishModuleService>(PUBLISH_MODULE);
  await publish.publishAll();
  await publish.buildCatalogueSnapshot();
}
