import { testContactClickRoute } from '@podbor/lead-crm/testing';
import { POST } from './contact-click';
import { leadStore } from '@/lib/crm';

testContactClickRoute({
  brand: 'Approved.rs',
  POST,
  readLeads: leadStore.readLeads,
});
