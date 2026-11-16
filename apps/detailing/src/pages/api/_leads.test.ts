import { testLeadsRoute } from '@podbor/lead-crm/testing';
import { POST } from './leads';
import { leadStore } from '@/lib/crm';

testLeadsRoute({ brand: 'Details', POST, readLeads: leadStore.readLeads });
