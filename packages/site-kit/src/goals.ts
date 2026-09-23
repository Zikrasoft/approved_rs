export const GOALS = {
  scroll50: 'scroll_50',
  scroll90: 'scroll_90',
  formView: 'form_view',
  formStart: 'form_start',
  formError: 'form_error',
  formSubmit: 'form_submit',
  contactClick: 'contact_click',
  leadModalOpen: 'lead_modal_open',
  brandLinkClick: 'brand_link_click',
  langOfferShown: 'lang_offer_shown',
  langOfferTaken: 'lang_offer_taken',
  langOfferDismissed: 'lang_offer_dismissed',
} as const;

export type Goal = (typeof GOALS)[keyof typeof GOALS];

export function reachGoal(goal: Goal, params?: Record<string, unknown>): void {
  window.ymReachGoal?.(goal, params);
}
