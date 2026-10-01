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
