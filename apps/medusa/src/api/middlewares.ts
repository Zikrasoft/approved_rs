import { defineMiddlewares } from '@medusajs/framework/http';

import { limitPublishes } from './admin/publish-limit';
import {
  fillProductDefaults,
  refuseGuardedBatchEdits,
  refuseProductImports,
  requireReadyToPublish,
  requireValidSpec,
} from './admin/products/require-fields';
import {
  limitIdentityRegistrations,
  limitPasswordLogins,
  limitPasswordResets,
} from './store/admin-login-limit';
import { limitCartCompletions } from './store/complete-limit';

export default defineMiddlewares({
  routes: [
    {
      matcher: '/store/carts/:id/complete',
      method: 'POST',
      middlewares: [limitCartCompletions],
    },
    {
      matcher: '/admin/products',
      method: 'POST',
      middlewares: [
        fillProductDefaults,
        requireValidSpec,
        requireReadyToPublish,
      ],
    },
    {
      matcher: /^\/admin\/products\/imports?(\/|$)/,
      method: 'POST',
      middlewares: [refuseProductImports],
    },
    {
      matcher: '/admin/products/batch',
      method: 'POST',
      middlewares: [refuseGuardedBatchEdits],
    },
    {
      matcher: '/admin/products/:id',
      method: 'POST',
      middlewares: [requireValidSpec, requireReadyToPublish],
    },
    {
      matcher: '/admin/publish',
      method: 'POST',
      middlewares: [limitPublishes],
    },
    {
      matcher: '/auth/:actor_type/:auth_provider',
      method: ['GET', 'POST'],
      middlewares: [limitPasswordLogins],
    },
    {
      matcher: '/auth/:actor_type/:auth_provider/register',
      method: 'POST',
      middlewares: [limitIdentityRegistrations],
    },
    {
      matcher: '/auth/:actor_type/:auth_provider/reset-password',
      method: 'POST',
      middlewares: [limitPasswordResets],
    },
  ],
});
