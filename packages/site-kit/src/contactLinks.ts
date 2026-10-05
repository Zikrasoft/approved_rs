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

export const telegramBotLink = (botUsername: string): string =>
  `https://t.me/${botUsername}`;

export const captureBotLink = (
  botUsername: string,
  locale: string,
  service?: string,
): string =>
  `${telegramBotLink(botUsername)}?start=${encodeURIComponent(
    service ? `${service}_${locale}` : locale,
  )}`;

export const START_PAYLOAD_LIMIT = 64;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VISITOR_SEGMENT =
  /_([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/;

export function readStartVisitor(payload: string): {
  payload: string;
  visitorId: string | null;
} {
  const match = VISITOR_SEGMENT.exec(payload);
  return match
    ? {
        payload: payload.slice(0, match.index),
        visitorId: match.slice(1).join('-'),
      }
    : { payload, visitorId: null };
}

export function stampStartVisitor(
  payload: string,
  visitorId: string,
): string | null {
  if (!UUID.test(visitorId)) return null;
  const stamped = `${readStartVisitor(payload).payload}_${visitorId.replaceAll('-', '')}`;
  return stamped.length <= START_PAYLOAD_LIMIT ? stamped : null;
}
