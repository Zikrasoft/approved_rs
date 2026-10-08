import { describe, expect, it, vi } from 'vitest';
import { defineLeadForm } from '@podbor/lead-crm/lead-form';
import { getOrCreateVisitorId } from './browser.ts';
import { detectVisitorCountry, visitorChannel } from './contactPreference.ts';
import { markFieldValidity } from './fieldValidity.ts';
import { defineSiteLeadForm } from './leadForm.ts';

vi.mock('@podbor/lead-crm/lead-form', () => ({ defineLeadForm: vi.fn() }));

describe('defineSiteLeadForm', () => {
  it('wires the lead form to the site-kit visitor helpers', () => {
    defineSiteLeadForm('test-form');
    expect(defineLeadForm).toHaveBeenCalledWith(
      {
        visitorId: getOrCreateVisitorId,
        markFieldValidity,
        preferredChannel: visitorChannel,
        visitorCountry: detectVisitorCountry,
      },
      'test-form',
    );
  });
});
