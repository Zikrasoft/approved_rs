export { safeMarkdown, safeMarkdownInline } from './safeMarkdown.ts';
export { breadcrumbListSchema } from './breadcrumbSchema.ts';
export { jsonLdText } from './jsonLd.ts';
export type { ContactPlacement } from './goals.ts';
export { relatedEntries } from './relatedEntries.ts';
export { mapEmbedSrc, mapPlaceUrl } from './mapEmbed.ts';
export {
  LOCALE_CHOICE_ATTRIBUTE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  localeCookieValue,
} from './localeCookie.ts';
export { isActiveNavPath, navCurrent, swapLocalePath } from './navPath.ts';
export { readOrCreateVisitorId } from './visitorId.ts';
export { createUnlocalizedMatcher } from './unlocalizedPath.ts';
export {
  STORAGE_KEY as CONSENT_STORAGE_KEY,
  parseConsent,
  newConsent,
} from './consent.ts';
export type { Consent } from './consent.ts';
export type { VisitorIdEnvironment } from './visitorId.ts';
export type { Crumb } from './breadcrumbSchema.ts';
export type { UnlocalizedPaths } from './unlocalizedPath.ts';
