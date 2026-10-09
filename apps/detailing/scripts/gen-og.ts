import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DETAILS } from '@podbor/brands';
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
const font = (spec: string) =>
  inlineFontCss(createRequire(import.meta.url).resolve(spec));

interface HomeCopy {
  hero: {
    eyebrow: string;
    titleTop: string;
    titleAccent: string;
    titleBottom: string;
  };
  marquee: string[];
}

const home: HomeCopy & { translations?: Record<string, HomeCopy> } = parse(
  readFileSync(app('src/content/i18n/home.yaml'), 'utf8'),
);
const inLocale = (locale: Locale) =>
  locale === 'ru' ? home : (home.translations?.[locale] ?? home);

const FONTS = [
  '@fontsource-variable/unbounded/wght.css',
  '@fontsource-variable/manrope/wght.css',
]
  .map(font)
  .join('\n');

const photo = dataUri(
  await sharp(app('src/content/works/mersedes-benz-gls/image.jpg'))
    .resize(960)
    .jpeg({ quality: 82 })
    .toBuffer(),
  '.jpg',
);

function page({ hero, marquee }: HomeCopy) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #060608; color: #f2f0ec; font-family: 'Manrope Variable', sans-serif; position: relative; }
.photo { position: absolute; top: 0; right: 0; width: 64%; height: 100%; object-fit: cover; object-position: 58% 40%; }
.veil { position: absolute; inset: 0; background:
  linear-gradient(90deg, #060608 34%, rgba(6,6,8,.78) 56%, rgba(6,6,8,.2) 100%),
  linear-gradient(0deg, rgba(6,6,8,.92) 0%, rgba(6,6,8,0) 42%); }
.glow { position: absolute; left: 22%; bottom: -46%; width: 640px; height: 640px; border-radius: 50%; background: radial-gradient(circle, #e3c08a, transparent 62%); opacity: .16; filter: blur(90px); }
main { position: relative; height: 100%; padding: 52px 56px 50px; display: flex; flex-direction: column; }
header { display: flex; align-items: center; justify-content: space-between; }
.mark { display: flex; align-items: center; gap: 18px; font-family: 'Unbounded Variable', sans-serif; font-weight: 600; font-size: 34px; letter-spacing: .12em; }
.pill { padding: 12px 24px; border-radius: 999px; border: 1px solid rgba(255,255,255,.18); background: rgba(12,12,17,.85); font-size: 22px; font-weight: 500; color: #e4e4ea; }
h1 { margin-top: auto; font-family: 'Unbounded Variable', sans-serif; font-weight: 600; font-size: 78px; line-height: 1.04; letter-spacing: -0.03em; white-space: nowrap; overflow: hidden; }
h1 span { display: block; }
.iridescent { background: linear-gradient(100deg, #9aa3b2 0%, #d8cbb4 26%, #e3c08a 58%, #c08f4f 82%); -webkit-background-clip: text; background-clip: text; color: transparent; }
ul { margin-top: 36px; display: flex; flex-wrap: wrap; gap: 10px; height: 52px; overflow: hidden; list-style: none; padding: 0; }
li { padding: 10px 20px; border-radius: 999px; border: 1px solid rgba(255,255,255,.14); font-size: 22px; font-weight: 500; color: #c2c2cb; }
</style></head><body>
<img class="photo" src="${photo}" alt="">
<div class="veil"></div>
<div class="glow"></div>
<main>
  <header>
    <div class="mark">
      <svg width="34" height="34" viewBox="0 0 16 16"><defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#9B8CFF"/><stop offset="45%" stop-color="#6FD3E8"/><stop offset="100%" stop-color="#E3C08A"/></linearGradient></defs><path d="M8 0 16 16H0L8 0Z" fill="url(#p)"/></svg>
      ${esc(DETAILS.name)}
    </div>
    <div class="pill">${esc(hero.eyebrow)}</div>
  </header>
  <h1 data-fit><span>${esc(hero.titleTop)}</span><span class="iridescent">${esc(hero.titleAccent)}</span><span>${esc(hero.titleBottom)}</span></h1>
  <ul>${marquee.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
</main>
</body></html>`;
}

await renderOgImages(
  localeConfig.locales.map((locale) => ({
    html: page(inLocale(locale)),
    out: app(`public/og${localeConfig.ogSuffix[locale]}.png`),
  })),
);

const favicon = readFileSync(app('public/favicon.svg'));
for (const size of [192, 512]) {
  const png = await sharp(favicon, { density: (72 * size) / 32 })
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(app(`public/icon-${size}.png`), png);
  console.log(`wrote public/icon-${size}.png`);
}
