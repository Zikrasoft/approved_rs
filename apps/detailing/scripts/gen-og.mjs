import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { localeConfig, OG_IMAGE } from '../src/i18n/config.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = (name) => new URL(`public/${name}`, `file://${root}`);

const COPY = {
  sr: {
    headline: 'Studio za detailing',
    accent: 'u Beogradu',
    services:
      'PPF folija · Promena boje · Poliranje · Keramika · Restauracija volana',
  },
  ru: {
    headline: 'Детейлинг-студия',
    accent: 'в Белграде',
    services: 'Плёнка · Смена цвета · Полировка · Керамика · Реставрация руля',
  },
  en: {
    headline: 'Car detailing studio',
    accent: 'in Belgrade',
    services:
      'PPF · Colour change · Polishing · Ceramic · Steering wheel restoration',
  },
};

for (const [name, map] of Object.entries({ OG_IMAGE, COPY })) {
  const missing = localeConfig.locales.filter((l) => !Object.hasOwn(map, l));
  if (missing.length) {
    throw new Error(
      `gen-og: ${name} has no entry for ${missing.join(', ')} — add it before generating OG images`,
    );
  }
}

const GLYPHS = {
  D: { advance: 96, d: 'M6 94V6h32a44 44 0 0 1 0 88z' },
  e: { advance: 82, d: 'M66 61a33 33 0 1 0-9.7 23.3M0 61h66' },
  t: { advance: 62, d: 'M24 4v90M2 30h46' },
  a: {
    advance: 82,
    d: 'M66 28v66M33 28a33 33 0 1 0 0 66 33 33 0 1 0 0-66z',
  },
  i: { advance: 26, d: 'M8 28v66', dot: true },
  l: { advance: 26, d: 'M8 4v90' },
  s: { advance: 76, d: 'M64 44a32 16.5 0 1 0-32 17 32 16.5 0 1 1-32 17' },
};

const TRACKING = 10;

function wordmark({ x, y, capHeight, fill }) {
  const scale = capHeight / 100;
  let cursor = 0;
  const parts = [];
  for (const char of 'Details') {
    const glyph = GLYPHS[char];
    parts.push(`<path transform="translate(${cursor} 0)" d="${glyph.d}"/>`);
    if (glyph.dot) {
      parts.push(`<circle cx="${cursor + 8}" cy="11" r="6" fill="${fill}"/>`);
    }
    cursor += glyph.advance + TRACKING;
  }
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${fill}" stroke-width="12" stroke-linecap="butt" stroke-linejoin="round">${parts.join('')}</g>`;
}

function svg({ headline, accent, services }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="prism" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9B8CFF"/>
      <stop offset="45%" stop-color="#6FD3E8"/>
      <stop offset="100%" stop-color="#E3C08A"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0.82" cy="0.1" r="0.6">
      <stop offset="0%" stop-color="#9B8CFF" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#9B8CFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.1" cy="0.9" r="0.6">
      <stop offset="0%" stop-color="#E3C08A" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#E3C08A" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#060608"/>
  <rect width="1200" height="630" fill="url(#glowA)"/>
  <rect width="1200" height="630" fill="url(#glowB)"/>
  <path d="M92 84 L136 160 H48 Z" fill="url(#prism)"/>
  ${wordmark({ x: 168, y: 108, capHeight: 44, fill: '#F2F0EC' })}
  <text x="48" y="360" font-family="sans-serif" font-size="76" font-weight="600" fill="#F2F0EC">${headline}</text>
  <text x="48" y="452" font-family="sans-serif" font-size="76" font-weight="600" fill="url(#prism)">${accent}</text>
  <text x="48" y="552" font-family="sans-serif" font-size="28" fill="#8E8E99">${services}</text>
</svg>`;
}

for (const locale of localeConfig.locales) {
  const name = OG_IMAGE[locale].replace(/^\//, '');
  writeFileSync(
    out(name),
    await sharp(Buffer.from(svg(COPY[locale])))
      .png()
      .toBuffer(),
  );
  console.log(`wrote public/${name}`);
}

const favicon = readFileSync(out('favicon.svg'));
for (const size of [192, 512]) {
  const png = await sharp(favicon, { density: (72 * size) / 32 })
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(out(`icon-${size}.png`), png);
  console.log(`wrote public/icon-${size}.png`);
}
