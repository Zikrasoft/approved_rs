export { safeMarkdown, safeMarkdownInline } from './safeMarkdown.ts';
export { breadcrumbListSchema } from './breadcrumbSchema.ts';
export { jsonLdText } from './jsonLd.ts';
export { formatPhone } from './formatPhone.ts';
export { mapEmbedSrc } from './mapEmbed.ts';
export {
  LOCALE_CHOICE_ATTRIBUTE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  localeCookieValue,
} from './localeCookie.ts';
export { isActiveNavPath, swapLocalePath } from './navPath.ts';
export { readOrCreateVisitorId } from './visitorId.ts';
export {
  STORAGE_KEY as CONSENT_STORAGE_KEY,
  parseConsent,
  newConsent,
  analyticsAllowed,
} from './consent.ts';
export type { Consent } from './consent.ts';
export type { VisitorIdEnvironment } from './visitorId.ts';
export type { MapPlace } from './mapEmbed.ts';
export type { Crumb } from './breadcrumbSchema.ts';
