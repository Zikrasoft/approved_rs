import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite' with { 'resolution-mode': 'import' };

const PLACEHOLDER_FAVICON = /<link[^>]*data-placeholder-favicon[^>]*>/;

export const adminFaviconLink = (ico: Buffer) =>
  `<link rel="icon" href="data:image/x-icon;base64,${ico.toString('base64')}" sizes="16x16 32x32 48x48" />`;

export const withAdminFavicon = (html: string, ico: Buffer) => {
  const link = adminFaviconLink(ico);
  return PLACEHOLDER_FAVICON.test(html)
    ? html.replace(PLACEHOLDER_FAVICON, link)
    : html.replace('</head>', `${link}</head>`);
};

export const adminFavicon = (): Plugin => ({
  name: 'carlab-admin-favicon',
  transformIndexHtml: (html) =>
    withAdminFavicon(
      html,
      readFileSync(path.join(__dirname, 'admin-favicon.ico')),
    ),
});
