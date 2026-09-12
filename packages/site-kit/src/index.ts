export { safeMarkdown, safeMarkdownInline } from './safeMarkdown.ts';
export { formatPhone } from './formatPhone.ts';
export { readOrCreateVisitorId } from './visitorId.ts';
export {
  STORAGE_KEY as CONSENT_STORAGE_KEY,
  parseConsent,
  newConsent,
  analyticsAllowed,
} from './consent.ts';
export type { Consent } from './consent.ts';
export type { VisitorIdEnvironment } from './visitorId.ts';
