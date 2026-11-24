export const prerender = false;

import { createRemindersRoute } from '@podbor/lead-crm';
import { leadStore } from '@/lib/crm';
import { crmBot } from '@/lib/crmBot';

export const GET = createRemindersRoute({ leadStore, bot: crmBot });
