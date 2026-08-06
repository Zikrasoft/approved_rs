import type { Locale } from '@/i18n/config';

// No single default: the prefilled greeting depends on the visitor's locale,
// so every caller resolves DEFAULT_TG_MESSAGE[locale] itself and passes it
// in explicitly (or `null` for a bare link with no prefilled text).
export const DEFAULT_TG_MESSAGE: Record<Locale, string> = {
  ru: 'Здравствуйте! Подскажите, пожалуйста, по автоподбору и доставке авто.',
  en: "Hi! Could you tell me more about car sourcing and delivery?",
  sr: 'Zdravo! Možete li mi reći nešto više o odabiru i dostavi vozila?',
};

export function telegramLink(manager: string, text: string | null): string {
  return text ? `https://t.me/${manager}?text=${encodeURIComponent(text)}` : `https://t.me/${manager}`;
}
