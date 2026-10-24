import { MedusaService } from '@medusajs/framework/utils';

import PublishedNumber from './models/published-number';
import PublishRun from './models/publish-run';

class PublishModuleService extends MedusaService({
  PublishRun,
  PublishedNumber,
}) {}

export default PublishModuleService;
