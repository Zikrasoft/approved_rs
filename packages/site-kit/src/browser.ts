export { bootSiteKit, type SiteKitConfig } from './boot.ts';
export {
  defineBrowsingDepth,
  DEPTH_DOOR_ATTRIBUTE,
  DEPTH_SLUG_ATTRIBUTE,
} from './browsingDepth.ts';
export { markFieldValidity } from './fieldValidity.ts';
export { METRIKA_MASK_CLASS } from './analytics.ts';
export { DEVELOPER_CREDIT_ATTRIBUTE } from './funnel.ts';
export { GOALS, reachGoal, type Goal } from './goals.ts';
export { defineCtaReveal } from './ctaReveal.ts';
export { defineCompareSlider } from './compareSlider.ts';
export { defineScrollReveal } from './scrollReveal.ts';
export { defineLazyMapEmbed } from './mapEmbed.ts';
export { defineLocaleChoice } from './localeCookie.ts';
export { defineTelegramChoice } from './telegramChoice.ts';
export {
  COPY_PHONE_DIGITS_ATTRIBUTE,
  COPY_PHONE_NUMBER_ATTRIBUTE,
  COPY_PHONE_STATUS_ATTRIBUTE,
  defineCopyPhone,
} from './copyPhone.ts';
export { defineMenuToggle, type MenuToggleElement } from './menuToggle.ts';
export { defineChipFilter } from './chipFilter.ts';
export { defineLightbox } from './lightbox.ts';
export { defineZoneMap } from './zoneMap.ts';
export { lockScroll, unlockScroll } from './scrollLock.ts';
export {
  defineModalDialog,
  MODAL_FOCUS_ATTRIBUTE,
  MODAL_OPEN_EVENT,
  type ModalOpenDetail,
} from './modalDialog.ts';
export {
  defineCookieConsent,
  COOKIE_CONSENT_HEIGHT_VAR,
  CONSENT_EVENT,
  type ConsentDetail,
} from './cookieConsent.ts';
export {
  STORAGE_KEY as CONSENT_STORAGE_KEY,
  analyticsDeclined,
} from './consent.ts';
export { VISITOR_ID_STORAGE_KEY, getOrCreateVisitorId } from './visitorId.ts';
export {
  MY_GARAGE_VIN_ATTRIBUTE,
  defineMyGarage,
  rememberVin,
  storedVin,
} from './myGarage.ts';
