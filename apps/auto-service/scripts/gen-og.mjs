import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));

function svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#F5F4F1"/>
  <rect y="0" width="1200" height="10" fill="#CC4A16"/>
  <text x="64" y="130" font-family="sans-serif" font-size="40" font-weight="600" letter-spacing="8" fill="#17191C">AUTO</text>
  <rect x="230" y="92" width="150" height="52" fill="#CC4A16"/>
  <text x="246" y="130" font-family="sans-serif" font-size="40" font-weight="600" letter-spacing="8" fill="#FFFFFF">HUB</text>
  <text x="64" y="330" font-family="sans-serif" font-size="64" font-weight="600" fill="#17191C">Автосервис в Белграде</text>
  <text x="64" y="410" font-family="sans-serif" font-size="30" fill="#656B74">Диагностика · ТО · Ходовая · Двигатель · Кузов после ДТП</text>
  <text x="64" y="470" font-family="sans-serif" font-size="30" fill="#656B74">Аккумуляторы с подбором и установкой</text>
  <rect x="64" y="524" width="330" height="54" fill="#17191C"/>
  <text x="88" y="559" font-family="sans-serif" font-size="24" fill="#FFFFFF">Смета до начала работ</text>
</svg>`;
}

const buffer = await sharp(Buffer.from(svg())).png().toBuffer();
writeFileSync(new URL('public/og.png', `file://${root}`), buffer);
console.log('wrote public/og.png');
