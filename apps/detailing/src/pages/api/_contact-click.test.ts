import '@podbor/lead-crm/testing/database';
import { testContactClickRoute } from '@podbor/lead-crm/testing';
import { POST } from './contact-click';
import { leadStore } from '@/lib/crm';

testContactClickRoute({
  brand: 'Details',
  POST,
  readLeads: leadStore.readLeads,
});
