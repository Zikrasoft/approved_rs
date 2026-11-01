import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineLeadForm } from '@podbor/lead-crm/lead-form';
import { storedAdTouch, storedMetaIds } from './adTouch.ts';
import { getOrCreateVisitorId } from './browser.ts';
import {
  detectVisitorCountry,
  visitorChannel,
  type ContactRanking,
} from './contactPreference.ts';
import { markFieldValidity } from './fieldValidity.ts';
import { defineSiteLeadForm } from './leadForm.ts';

vi.mock('@podbor/lead-crm/lead-form', () => ({ defineLeadForm: vi.fn() }));
vi.mock('./contactPreference.ts', async (actual) => ({
  ...(await actual<typeof import('./contactPreference.ts')>()),
  visitorChannel: vi.fn(() => 'viber'),
}));

const deps = () => vi.mocked(defineLeadForm).mock.lastCall![0];

beforeEach(() => vi.mocked(defineLeadForm).mockClear());

describe('defineSiteLeadForm', () => {
  it('wires the lead form to the site-kit visitor helpers', () => {
    defineSiteLeadForm({ tagName: 'test-form' });
    expect(defineLeadForm).toHaveBeenCalledWith(
      {
        visitorId: getOrCreateVisitorId,
        adSource: storedAdTouch,
        metaIds: storedMetaIds,
        markFieldValidity,
        preferredChannel: expect.any(Function),
        visitorCountry: detectVisitorCountry,
      },
      'test-form',
    );
  });

  it('picks the preferred channel by the default ranking', () => {
    defineSiteLeadForm();
    expect(deps().preferredChannel!()).toBe('viber');
    expect(visitorChannel).toHaveBeenLastCalledWith(undefined);
  });

  it('picks the preferred channel by the brand ranking it is given', () => {
    const ranking: ContactRanking = { byCountry: new Map(), fallback: [] };
    defineSiteLeadForm({ contactRanking: ranking });
    deps().preferredChannel!();
    expect(visitorChannel).toHaveBeenLastCalledWith(ranking);
  });
});
