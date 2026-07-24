import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '../public');

const W = 1200;
const H = 630;

function renderSvg({ tagline, subtagline }) {
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="#F4F6FA"/>

  <!-- Subtle bottom-right glow -->
  <ellipse cx="1050" cy="520" rx="380" ry="280"
    fill="#1E3A5F" opacity="0.05"/>

  <!-- Ghost deco word -->
  <text x="${W + 20}" y="${H - 30}"
    text-anchor="end"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="320" font-weight="bold" font-style="italic"
    fill="none" stroke="#1E3A5F" stroke-width="1.5" opacity="0.055"
    letter-spacing="-12">AUTO</text>

  <!-- Left accent vertical bar -->
  <rect x="72" y="72" width="2.5" height="${H - 144}" fill="#1E3A5F" rx="1.5" opacity="0.35"/>

  <!-- Eyebrow label -->
  <text x="96" y="122"
    font-family="Arial, Helvetica, sans-serif"
    font-size="12" font-weight="600" fill="#6B7280"
    letter-spacing="4">АВТОПОДБОР · ДОСТАВКА · ЕВРОПА</text>

  <!-- Brand: APPROVED -->
  <text x="90" y="290"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="128" font-weight="bold" font-style="italic"
    fill="#0D0F14" letter-spacing="-4">APPROVED</text>

  <!-- .RS badge (pill) -->
  <rect x="92" y="308" width="80" height="34" rx="3" fill="#1E3A5F"/>
  <text x="132" y="332"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="14" font-weight="700" fill="#F4F6FA"
    letter-spacing="3">.RS</text>

  <!-- Tagline -->
  <text x="96" y="416"
    font-family="Arial, Helvetica, sans-serif"
    font-size="26" fill="#2D3448">
    ${tagline}
  </text>

  <!-- Sub-tagline -->
  <text x="96" y="462"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17" fill="#6B7280" letter-spacing="0.5">
    ${subtagline}
  </text>

  <!-- Separator -->
  <line x1="96" y1="510" x2="520" y2="510" stroke="#D8DCE8" stroke-width="1"/>

  <!-- URL -->
  <text x="96" y="553"
    font-family="Arial, Helvetica, sans-serif"
    font-size="18" font-weight="600" fill="#1E3A5F" letter-spacing="0.5">approved.rs</text>

  <!-- Outer border -->
  <rect x="3" y="3" width="${W - 6}" height="${H - 6}"
    fill="none" stroke="#D8DCE8" stroke-width="1.5" rx="2"/>

</svg>`;
}

async function renderOg(outPath, options) {
  const buf = await sharp(Buffer.from(renderSvg(options)))
    .png({ quality: 95 })
    .toBuffer();
  writeFileSync(outPath, buf);
  console.log(`✓ saved (${(buf.length / 1024).toFixed(0)} KB) → ${outPath.replace(PUBLIC, 'public')}`);
}

const DEFAULT_SUB = 'Германия · Испания · Сербия · Полностью удалённо, через Telegram';

const SERVICE_VARIANTS = {
  autopodbor: 'Подберём и проверим автомобиль под ваши критерии',
  dostavka: 'Доставим ваш автомобиль из Европы до двери',
  vykup: 'Срочный выкуп авто на иностранных номерах',
  proverka: 'Независимая проверка перед покупкой',
  combined: 'Подбор, проверка и доставка — под ключ',
};

await renderOg(join(PUBLIC, 'og.png'), {
  tagline: 'Подберём и доставим автомобиль из Европы',
  subtagline: DEFAULT_SUB,
});

mkdirSync(join(PUBLIC, 'og'), { recursive: true });
for (const [service, tagline] of Object.entries(SERVICE_VARIANTS)) {
  await renderOg(join(PUBLIC, 'og', `${service}.png`), { tagline, subtagline: DEFAULT_SUB });
}
