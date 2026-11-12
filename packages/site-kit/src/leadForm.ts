import { defineLeadForm } from '@podbor/lead-crm/lead-form';
import { storedAdTouch, storedMetaIds } from './adTouch.ts';
import { getOrCreateVisitorId } from './visitorId.ts';
import {
  detectVisitorCountry,
  visitorChannel,
  type ContactRanking,
} from './contactPreference.ts';
import { markFieldValidity } from './fieldValidity.ts';

export {
  defineLeadModal,
  DEFAULT_SERVICE_ATTRIBUTE,
  LEAD_SERVICE_ATTRIBUTE,
  OPEN_LEAD_MODAL_ATTRIBUTE,
  PAGE_LEAD_MODAL_ATTRIBUTE,
} from './leadModal.ts';

export function defineSiteLeadForm({
  tagName,
  contactRanking,
}: { tagName?: string; contactRanking?: ContactRanking } = {}): void {
  defineLeadForm(
    {
      visitorId: getOrCreateVisitorId,
      adSource: storedAdTouch,
      metaIds: storedMetaIds,
      markFieldValidity,
      preferredChannel: () => visitorChannel(contactRanking),
      visitorCountry: detectVisitorCountry,
    },
    tagName,
  );
}
