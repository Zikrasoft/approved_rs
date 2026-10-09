import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';
import {
  dataUri,
  escapeHtml as esc,
  inlineFontCss,
  renderOgImages,
} from '@podbor/site-kit/og';
import { localeConfig, type Locale } from '../src/i18n/config.ts';

const app = (path: string) =>
  fileURLToPath(new URL(`../${path}`, import.meta.url));

interface HomeCopy {
  hero: { heading: string; badges: string[] };
}

const home: HomeCopy & { translations?: Record<string, HomeCopy> } = parse(
  readFileSync(app('src/content/i18n/home.yaml'), 'utf8'),
);
const inLocale = (locale: Locale) =>
  locale === 'ru' ? home : (home.translations?.[locale] ?? home);

const FONTS = inlineFontCss(
  createRequire(import.meta.url).resolve('@fontsource-variable/onest/wght.css'),
);

const photo = dataUri(
  await sharp(app('src/assets/hero-workshop.jpg'))
    .resize(900)
    .jpeg({ quality: 82 })
    .toBuffer(),
  '.jpg',
);

function page({ hero }: HomeCopy) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #ffffff; color: #14161a; font-family: 'Onest Variable', sans-serif; padding: 28px 40px 40px; display: flex; flex-direction: column; gap: 20px; }
.logo { font-size: 48px; font-weight: 800; letter-spacing: -0.04em; }
.logo span { color: #f4661e; }
.card { flex: 1; display: grid; grid-template-columns: 1.3fr 0.7fr; border-radius: 28px; overflow: hidden; background: #1e2128; color: #fff; }
.copy { padding: 56px 52px 48px; display: flex; flex-direction: column; }
h1 { margin-top: auto; text-wrap: balance; font-size: 88px; font-weight: 800; line-height: 1.02; letter-spacing: -0.035em; }
ul { margin-top: 36px; list-style: none; padding: 0; display: flex; flex-direction: column; gap: 14px; font-size: 28px; color: #c3c7d0; }
li::before { content: '✓'; color: #f4661e; font-weight: 700; margin-right: 14px; }
img { width: 100%; height: 100%; object-fit: cover; object-position: 40% 50%; }
</style></head><body>
<div class="logo">Car<span>Lab</span></div>
<div class="card">
  <div class="copy">
    <h1>${esc(hero.heading)}</h1>
    <ul>${hero.badges.map((badge) => `<li>${esc(badge)}</li>`).join('')}</ul>
  </div>
  <img src="${photo}" alt="">
</div>
</body></html>`;
}

await renderOgImages(
  localeConfig.locales.map((locale) => ({
    html: page(inLocale(locale)),
    out: app(`public/og${localeConfig.ogSuffix[locale]}.png`),
  })),
);

const favicon = readFileSync(app('public/favicon.svg'));
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
] as const) {
  writeFileSync(
    app(`public/${name}`),
    await sharp(favicon, { density: 512 }).resize(size, size).png().toBuffer(),
  );
  console.log(`wrote public/${name}`);
}
