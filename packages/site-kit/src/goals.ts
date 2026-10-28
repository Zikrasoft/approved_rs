export const GOALS = {
  scroll50: 'scroll_50',
  scroll90: 'scroll_90',
  formView: 'form_view',
  formStart: 'form_start',
  formError: 'form_error',
  formSubmit: 'form_submit',
  contactClick: 'contact_click',
  leadModalOpen: 'lead_modal_open',
  telegramChoice: 'telegram_choice',
  brandLinkClick: 'brand_link_click',
  developerCreditClick: 'developer_credit_click',
  langOfferShown: 'lang_offer_shown',
  langOfferTaken: 'lang_offer_taken',
  langOfferDismissed: 'lang_offer_dismissed',
  addToCart: 'add_to_cart',
  beginCheckout: 'begin_checkout',
  purchase: 'purchase',
  caseView: 'case_view',
  search: 'search',
  searchSuggestionPick: 'search_suggestion_pick',
} as const;

export type Goal = (typeof GOALS)[keyof typeof GOALS];

export const CONTACT_PLACEMENTS = [
  'hero',
  'bar',
  'floating',
  'footer',
  'header',
  'thanks',
] as const;

export type ContactPlacement = (typeof CONTACT_PLACEMENTS)[number];

export const CONTACT_PLACEMENT_ATTRIBUTE = 'data-contact-placement';

export function reachGoal(goal: Goal, params?: Record<string, unknown>): void {
  window.trackGoal?.(goal, params);
}
