export const DEFAULT_TG_MESSAGE = 'Здравствуйте! Подскажите, пожалуйста, по автоподбору и доставке авто.';

// Pass `text: null` for a bare link (e.g. an inline "reach us on Telegram"
// mention) instead of a CTA button that should open a prefilled chat.
export function telegramLink(manager: string, text: string | null = DEFAULT_TG_MESSAGE): string {
  return text ? `https://t.me/${manager}?text=${encodeURIComponent(text)}` : `https://t.me/${manager}`;
}
