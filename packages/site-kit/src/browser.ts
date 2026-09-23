import { readOrCreateVisitorId } from './visitorId.ts';
export { defineAnalytics, type AnalyticsConfig } from './analytics.ts';
export {
  defineContactClickTracking,
  type ContactClickOptions,
} from './contactClick.ts';
export { defineFunnelTracking } from './funnel.ts';
export { markFieldValidity } from './fieldValidity.ts';
export { GOALS, reachGoal, type Goal } from './goals.ts';
export { defineCtaReveal } from './ctaReveal.ts';
export { defineLanguageSuggestion } from './languageSuggestion.ts';
export { defineLazyMapEmbed, mapEmbedSrc } from './mapEmbed.ts';
export { defineLocaleChoice } from './localeCookie.ts';
export { defineMenuToggle, type MenuToggleElement } from './menuToggle.ts';
export { defineRangeFilter } from './rangeFilter.ts';
export { defineZoneMap } from './zoneMap.ts';
export { lockScroll, unlockScroll } from './scrollLock.ts';
export {
  defineModalDialog,
  MODAL_OPEN_EVENT,
  type ModalOpenDetail,
} from './modalDialog.ts';
export {
  defineCookieConsent,
  CONSENT_EVENT,
  type ConsentDetail,
} from './cookieConsent.ts';
export {
  STORAGE_KEY as CONSENT_STORAGE_KEY,
  analyticsDeclined,
} from './consent.ts';
export { VISITOR_ID_STORAGE_KEY } from './visitorId.ts';

export function getOrCreateVisitorId(): string {
  try {
    return readOrCreateVisitorId({
      storage: localStorage,
      randomId: () => crypto.randomUUID(),
    });
  } catch {
    return '';
  }
}
