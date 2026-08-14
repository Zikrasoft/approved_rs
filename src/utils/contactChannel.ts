// Single source of truth for the site's contact channels — the domain that
// bridges typed Astro/TS code and untyped DOM string attributes
// (data-contact-channel="...", the LeadForm hidden contact_channel field,
// the contact-click.ts request body). Before this, each of those had its
// own separately-typed (or untyped) string union/Record for the same 4
// values — a channel added in one place could silently drift out of sync
// with another (e.g. a display-label map missing it), and reading an
// untyped value straight off `dataset`/`FormData` had nothing to catch a
// typo at either compile time or runtime.

// The set of contact channels that are an actual outbound contact action
// (leaves the site to call/message someone) — used by: the LeadForm
// contact-method tabs, the contact-click.ts beacon endpoint (and its
// BaseLayout.astro trigger), and Telegram's per-lead "(channel)" label.
// Not the full data-contact-channel domain — 'callback' also uses that
// attribute (it opens the lead-request modal instead) but isn't part of
// this set, and nothing in the codebase currently needs to type-check
// against the full 5-value domain, so there's no separate export for it.
export const TRACKED_CONTACT_CHANNELS = ['phone', 'telegram', 'whatsapp', 'viber'] as const;
export type TrackedContactChannel = (typeof TRACKED_CONTACT_CHANNELS)[number];

// Runtime guard for values that only ever arrive as plain strings (DOM
// dataset, FormData, JSON bodies) — narrows without an unchecked `as`
// assertion, and doubles as the allowlist check needed before using the
// value as an object key (an unvalidated string key on a plain object
// literal resolves inherited Object.prototype members instead of
// `undefined`, e.g. `obj['constructor']`).
export function isTrackedContactChannel(value: string | null | undefined): value is TrackedContactChannel {
  return !!value && (TRACKED_CONTACT_CHANNELS as readonly string[]).includes(value);
}

// The attribute every contact touchpoint carries (data-contact-channel="...")
// — one querySelector/dataset read in BaseLayout.astro, but centralized
// alongside the value/trigger constants above for the same reason they are:
// a typo in a raw literal here would silently stop matching anything.
export const DATA_CONTACT_CHANNEL = 'data-contact-channel';

// Attribute names that open the lead-request modal (LeadFormModal.astro,
// parametrized by `triggerAttr` so the same component serves the header's
// site-wide modal and a page-level one without them colliding). Before
// this, the two attribute-name strings were independently retyped in
// LeadFormModal's callers (Header.astro, ServicePageLayout.astro),
// Header.astro's own trigger-delegation script, ContactCTA.astro's
// dual-purpose Telegram/callback button, and BaseLayout.astro's
// contact-click exclusion check — several of which have to agree with each
// other for the modal to actually open, with nothing enforcing that.
export const DATA_OPEN_LEAD_MODAL = 'data-open-lead-modal';
export const DATA_OPEN_PAGE_LEAD_MODAL = 'data-open-page-lead-modal';
