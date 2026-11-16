import { testContactClickRoute } from '@podbor/lead-crm/testing';
import { POST } from './contact-click';
import { leadStore } from '@/lib/crm';

testContactClickRoute({
  brand: 'CarLab',
  POST,
  readLeads: leadStore.readLeads,
});
