import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { chromium } from 'playwright-core';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const MIME: Record<string, string> = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const dataUri = (bytes: Uint8Array, ext: string) => {
  const mime = MIME[ext.toLowerCase()];
  if (!mime) throw new Error(`dataUri: no media type for ${ext}`);
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
};

export const inlineFontCss = (cssPath: string) =>
  readFileSync(cssPath, 'utf8').replace(
    /url\((['"]?)(\.{1,2}\/[^'")]+)\1\)/g,
    (_, _quote, file: string) => {
      const path = resolve(dirname(cssPath), file);
      return `url(${dataUri(readFileSync(path), extname(path))})`;
    },
  );

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ESCAPES[char]!);

export const FIT_TEXT_SCRIPT = `for (const el of document.querySelectorAll('[data-fit]')) {
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && size > 12) {
    el.style.fontSize = (size -= 1) + 'px';
  }
}`;

export interface OgImage {
  html: string;
  out: string;
}

export async function renderOgImages(images: Iterable<OgImage>) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: OG_WIDTH, height: OG_HEIGHT },
    });
    for (const { html, out } of images) {
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate('document.fonts.ready');
      await page.evaluate(FIT_TEXT_SCRIPT);
      writeFileSync(out, await page.screenshot({ type: 'png' }));
      console.log(`wrote ${out}`);
    }
  } finally {
    await browser.close();
  }
}
