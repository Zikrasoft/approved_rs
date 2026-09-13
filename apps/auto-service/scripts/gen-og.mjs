import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { localeConfig, OG_SUFFIX } from '../src/i18n/config.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const asset = (name) => new URL(`public/${name}`, `file://${root}`);

const COPY = {
  sr: {
    heading: 'Auto servis u Beogradu',
    services: 'Dijagnostika · Servis · Kočnice i vešanje · Motor i menjač',
    extra: 'Limarija i lakiranje · Provera vozila pre kupovine',
    badge: 'Predračun pre početka radova',
  },
  ru: {
    heading: 'Автосервис в Белграде',
    services: 'Диагностика · ТО · Тормоза и подвеска · Двигатель и коробка',
    extra: 'Кузовной ремонт и покраска · Проверка перед покупкой',
    badge: 'Смета до начала работ',
  },
  en: {
    heading: 'Car service in Belgrade',
    services: 'Diagnostics · Servicing · Brakes · Engine and gearbox',
    extra: 'Bodywork and respray · Pre-purchase inspection',
    badge: 'Quote before any work starts',
  },
};

for (const [name, map] of Object.entries({ COPY, OG_SUFFIX })) {
  const missing = localeConfig.locales.filter(
    (locale) => !Object.hasOwn(map, locale),
  );
  if (missing.length) {
    throw new Error(
      `gen-og: ${name} has no copy for ${missing.join(', ')} — add it before generating OG images`,
    );
  }
}

const esc = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg({ heading, services, extra, badge }) {
  const badgeWidth = Math.round(badge.length * 12.2) + 48;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#F5F4F1"/>
  <rect y="0" width="1200" height="10" fill="#CC4A16"/>
  <text x="64" y="130" font-family="sans-serif" font-size="40" font-weight="600" letter-spacing="8" fill="#17191C">CAR</text>
  <rect x="192" y="92" width="142" height="52" fill="#CC4A16"/>
  <text x="208" y="130" font-family="sans-serif" font-size="40" font-weight="600" letter-spacing="8" fill="#FFFFFF">LAB</text>
  <text x="64" y="330" font-family="sans-serif" font-size="64" font-weight="600" fill="#17191C">${esc(heading)}</text>
  <text x="64" y="410" font-family="sans-serif" font-size="30" fill="#656B74">${esc(services)}</text>
  <text x="64" y="470" font-family="sans-serif" font-size="30" fill="#656B74">${esc(extra)}</text>
  <rect x="64" y="524" width="${badgeWidth}" height="54" fill="#17191C"/>
  <text x="88" y="559" font-family="sans-serif" font-size="24" fill="#FFFFFF">${esc(badge)}</text>
</svg>`;
}

for (const locale of localeConfig.locales) {
  const name = `og${OG_SUFFIX[locale]}.png`;
  writeFileSync(
    asset(name),
    await sharp(Buffer.from(svg(COPY[locale])))
      .png()
      .toBuffer(),
  );
  console.log(`wrote public/${name}`);
}

const favicon = readFileSync(asset('favicon.svg'));
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  writeFileSync(
    asset(name),
    await sharp(favicon, { density: 512 }).resize(size, size).png().toBuffer(),
  );
  console.log(`wrote public/${name}`);
}
