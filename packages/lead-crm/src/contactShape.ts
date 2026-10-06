const PHONE_TYPED = /^[+(]?\d[\d\s().-]*$/;

export const TELEGRAM_HANDLE = /^@?[a-zA-Z]\w{2,31}$/;

export const typedAsPhone = (typed: string): boolean =>
  PHONE_TYPED.test(typed.trim());

export const telegramContact = (typed: string): string => {
  const handle = typed.trim().replace(/^@+/, '');
  return handle ? `@${handle}` : '';
};

export const isTelegramIdContact = (contact: string): boolean =>
  contact.startsWith('tg://user?id=');
