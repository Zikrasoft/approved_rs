import { ModuleProvider, Modules } from '@medusajs/framework/utils';

import BrevoNotificationService from './service';

export default ModuleProvider(Modules.NOTIFICATION, {
  services: [BrevoNotificationService],
});
