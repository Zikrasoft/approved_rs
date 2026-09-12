import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
function svg() {
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
  <text x="160" y="152" font-family="sans-serif" font-size="46" font-weight="600" letter-spacing="12" fill="#F2F0EC">PRIZMA</text>
  <text x="48" y="360" font-family="sans-serif" font-size="76" font-weight="600" fill="#F2F0EC">Детейлинг-студия</text>
  <text x="48" y="452" font-family="sans-serif" font-size="76" font-weight="600" fill="url(#prism)">в Белграде</text>
  <text x="48" y="552" font-family="sans-serif" font-size="30" fill="#8E8E99">Плёнка · Смена цвета · Полировка · Керамика · Реставрация руля</text>
</svg>`;
}

const buffer = await sharp(Buffer.from(svg())).png().toBuffer();
writeFileSync(new URL('public/og.png', `file://${root}`), buffer);
console.log('wrote public/og.png');
