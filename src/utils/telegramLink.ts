export const DEFAULT_TG_MESSAGE = 'Здравствуйте! Подскажите, пожалуйста, по автоподбору и доставке авто.';

export function telegramLink(manager: string, text: string = DEFAULT_TG_MESSAGE): string {
  return `https://t.me/${manager}?text=${encodeURIComponent(text)}`;
}
