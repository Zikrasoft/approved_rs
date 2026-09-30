import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WORKSHOP_ADDRESS } from '@podbor/brands';
import { createSectionLoader, withPlaceholder } from '@podbor/i18n/section';
import { MEDUSA_LOCALE, formatPrice } from '@podbor/shop-catalog';

import { emailsContentSchema } from './emails-schema';
import type { ShopLocale } from './shop';

export const EMAILS_PATH = join(
  __dirname,
  '..',
  'content',
  'i18n',
  'emails.yaml',
);

export const emailCopy = createSectionLoader<ShopLocale>()(
  emailsContentSchema,
  readFileSync(EMAILS_PATH, 'utf8'),
);

export type OrderEmailInput = {
  displayId: number;
  locale: ShopLocale;
  items: { title: string; quantity: number; total: number }[];
  total: number;
};

export type OrderEmail = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildOrderEmail(order: OrderEmailInput): OrderEmail {
  const copy = emailCopy(order.locale).orderPlaced;
  const price = (amount: number) =>
    formatPrice(amount, MEDUSA_LOCALE[order.locale]);
  const numbered = (text: string) =>
    withPlaceholder(text, 'displayId', String(order.displayId));

  const heading = numbered(copy.heading);
  const lines = order.items.map(
    (item) => `${item.title} × ${item.quantity} — ${price(item.total)}`,
  );
  const total = `${copy.totalLabel}: ${price(order.total)}`;
  const address = `${WORKSHOP_ADDRESS.street}, ${WORKSHOP_ADDRESS.city}`;

  const text = [
    heading,
    '',
    copy.intro,
    '',
    copy.itemsHeading,
    ...lines,
    total,
    '',
    copy.pickupHeading,
    address,
    copy.pickupNote,
  ].join('\n');

  const html = [
    `<!doctype html><html lang="${order.locale}">`,
    '<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5">',
    `<h1 style="font-size:20px">${escapeHtml(heading)}</h1>`,
    `<p>${escapeHtml(copy.intro)}</p>`,
    `<h2 style="font-size:16px">${escapeHtml(copy.itemsHeading)}</h2>`,
    `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
    `<p><strong>${escapeHtml(total)}</strong></p>`,
    `<h2 style="font-size:16px">${escapeHtml(copy.pickupHeading)}</h2>`,
    `<p>${escapeHtml(address)}<br>${escapeHtml(copy.pickupNote)}</p>`,
    '</body></html>',
  ].join('');

  return { subject: numbered(copy.subject), html, text };
}
