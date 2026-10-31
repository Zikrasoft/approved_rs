export const PREVIEW_COOKIE = 'auto_service_shop_preview';

export function previewTokenFrom(cookie: string | null): string {
  const prefix = `${PREVIEW_COOKIE}=`;
  const pair = (cookie ?? '')
    .split(/;\s*/)
    .find((part) => part.startsWith(prefix));
  return pair?.slice(prefix.length) ?? '';
}
