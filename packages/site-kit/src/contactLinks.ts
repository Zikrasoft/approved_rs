export const phoneLink = (number: string): string => `tel:+${number}`;

export const whatsappLink = (number: string): string =>
  `https://wa.me/${number}`;

export const viberLink = (number: string): string =>
  `viber://chat?number=%2B${number}`;

export const telegramLink = (handle: string): string =>
  `https://t.me/${handle}`;

export const instagramLink = (handle: string): string =>
  `https://www.instagram.com/${handle}`;
