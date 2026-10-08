const PHONE_TYPED = /^[+(]?\d[\d\s().-]*$/;
const TELEGRAM_LINK =
  /^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/([^/?#]*)\/?$/i;

export const TELEGRAM_HANDLE = /^@?[a-zA-Z]\w{2,31}$/;

export const typedAsPhone = (typed: string): boolean =>
  PHONE_TYPED.test(typed.trim());

export const telegramContact = (typed: string): string => {
  const trimmed = typed.trim();
  const handle = (TELEGRAM_LINK.exec(trimmed)?.[1] ?? trimmed).replace(
    /^@+/,
    '',
  );
  return handle ? `@${handle}` : '';
};

export const isTelegramIdContact = (contact: string): boolean =>
  contact.startsWith('tg://user?id=');
