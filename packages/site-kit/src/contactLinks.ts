export const phoneLink = (number: string): string => `tel:+${number}`;

const withText = (url: string, message?: string): string =>
  message ? `${url}?text=${encodeURIComponent(message)}` : url;

export const whatsappLink = (number: string, message?: string): string =>
  withText(`https://wa.me/${number}`, message);

export const viberLink = (number: string): string =>
  `viber://chat?number=%2B${number}`;

export const telegramLink = (handle: string, message?: string): string =>
  withText(`https://t.me/${handle}`, message);

export const instagramLink = (handle: string): string =>
  `https://www.instagram.com/${handle}`;

export const captureStartPayload = (
  service: string | undefined,
  locale: string,
): string => (service ? `${service}_${locale}` : locale);

export const telegramBotLink = (
  botUsername: string,
  startPayload?: string,
): string =>
  startPayload
    ? `https://t.me/${botUsername}?start=${encodeURIComponent(startPayload)}`
    : `https://t.me/${botUsername}`;
