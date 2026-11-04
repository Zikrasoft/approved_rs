export const prerender = false;

import { createCspReportRoute } from '@podbor/lead-crm';
import { reportShopEvent } from '@/lib/shopEvents';

export const POST = createCspReportRoute((violation) =>
  reportShopEvent(null, { event: 'storefront.csp', ...violation }),
);
