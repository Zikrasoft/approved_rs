import { defineLeadForm } from '@podbor/lead-crm/lead-form';
import { storedAdTouch } from './adTouch.ts';
import { getOrCreateVisitorId } from './browser.ts';
import { detectVisitorCountry, visitorChannel } from './contactPreference.ts';
import { markFieldValidity } from './fieldValidity.ts';

export function defineSiteLeadForm(tagName?: string): void {
  defineLeadForm(
    {
      visitorId: getOrCreateVisitorId,
      adSource: storedAdTouch,
      markFieldValidity,
      preferredChannel: visitorChannel,
      visitorCountry: detectVisitorCountry,
    },
    tagName,
  );
}
