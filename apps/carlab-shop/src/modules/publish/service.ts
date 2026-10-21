import { MedusaService } from '@medusajs/framework/utils';

import PublishRun from './models/publish-run';

class PublishModuleService extends MedusaService({
  PublishRun,
}) {}

export default PublishModuleService;
