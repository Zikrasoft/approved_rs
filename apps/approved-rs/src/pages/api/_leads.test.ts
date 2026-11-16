import { describe } from 'vitest';
import { PARTNER_SERVICE } from '@podbor/brands';
import { testLeadsRoute } from '@podbor/lead-crm/testing';
import { POST } from './leads';

testLeadsRoute({
  brand: 'Approved.rs',
  POST,
  fields: { service: 'vehicle-sourcing' },
  stored: { service: 'vehicle-sourcing' },
});

describe('a Lead sent through the partner block', () => {
  testLeadsRoute({
    brand: 'CarLab',
    POST,
    fields: { service: PARTNER_SERVICE.carlab },
    stored: { source_url: 'http://localhost/sr/' },
  });
});
