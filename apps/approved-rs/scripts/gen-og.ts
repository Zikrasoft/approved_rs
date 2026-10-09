import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { APPROVED } from '@podbor/brands';
import sharp from 'sharp';
import { parse } from 'yaml';
import {
  dataUri,
  escapeHtml as esc,
  inlineFontCss,
  renderOgImages,
  type OgImage,
} from '@podbor/site-kit/og';
import { localeConfig, type Locale } from '../src/i18n/config.ts';

const app = (path: string) =>
  fileURLToPath(new URL(`../${path}`, import.meta.url));
const font = (spec: string) =>
  inlineFontCss(createRequire(import.meta.url).resolve(spec));

const [BRAND_NAME, BRAND_TLD] = APPROVED.domain.split('.');

const yaml = (name: string) =>
  parse(readFileSync(app(`src/content/i18n/${name}.yaml`), 'utf8'));
const home = yaml('home');
const services = yaml('services');
const inLocale = <T>(
  doc: { translations?: Record<string, T> } & T,
  locale: Locale,
): T => (locale === 'ru' ? doc : (doc.translations?.[locale] ?? doc));

const FONTS = [
  '@fontsource/unbounded/700.css',
  '@fontsource/golos-text/400.css',
  '@fontsource/golos-text/600.css',
]
  .map(font)
  .join('\n');

const photo = async (name: string) =>
  dataUri(
    await sharp(app(`src/assets/${name}.jpg`))
      .resize(1600)
      .jpeg({ quality: 82 })
      .toBuffer(),
    '.jpg',
  );
const HOME_PHOTO = await photo('hero-delivery');
const SERVICE_PHOTO = {
  'vehicle-sourcing': await photo('service-sourcing'),
  'vehicle-buyback': await photo('service-buyback'),
  'vehicle-inspection': await photo('service-inspection'),
};

function page(
  photo: string,
  lines: string[],
  stats: { value: string; label: string }[],
) {
  const last = lines.length - 1;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #0a0b0c; color: #f5f3ef; font-family: 'Golos Text', sans-serif; position: relative; }
.photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 70% 62%; }
.veil { position: absolute; inset: 0; background:
  linear-gradient(90deg, rgba(10,11,12,.96) 0%, rgba(10,11,12,.86) 48%, rgba(10,11,12,.45) 100%),
  linear-gradient(0deg, rgba(10,11,12,.9) 0%, rgba(10,11,12,0) 40%); }
main { position: relative; height: 100%; padding: 60px 72px 56px; display: flex; flex-direction: column; }
.logo { font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 40px; letter-spacing: -0.02em; }
.logo span { color: #ef6247; }
h1 { margin-top: auto; font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 84px; line-height: 1.02; letter-spacing: -0.035em; white-space: nowrap; overflow: hidden; }
h1 span { display: block; }
h1 .accent { color: #ef6247; }
footer { margin-top: 44px; padding-top: 26px; border-top: 1px solid rgba(245,243,239,.14); display: flex; gap: 56px; font-size: 30px; color: #a9afae; }
footer b { color: #f5f3ef; font-weight: 600; }
</style></head><body>
<img class="photo" src="${photo}" alt="">
<div class="veil"></div>
<main>
  <div class="logo">${esc(BRAND_NAME!.toUpperCase())}<span>.${esc(BRAND_TLD!)}</span></div>
  <h1 data-fit>${lines.map((line, i) => `<span${i === last ? ' class="accent"' : ''}>${esc(line)}</span>`).join('')}</h1>
  <footer>${stats.map(({ value, label }) => `<div><b>${esc(value)}</b> ${esc(label)}</div>`).join('')}</footer>
</main>
</body></html>`;
}

const images: OgImage[] = [];
mkdirSync(app('public/og'), { recursive: true });
for (const locale of localeConfig.locales) {
  const suffix = localeConfig.ogSuffix[locale];
  const copy = inLocale(home, locale);
  const stats = [copy.statClients, copy.statYears];

  images.push({
    html: page(
      HOME_PHOTO,
      [copy.heroLine1, copy.heroLine2, copy.heroLine3],
      stats,
    ),
    out: app(`public/og${suffix}.png`),
  });

  for (const [service, servicePhoto] of Object.entries(SERVICE_PHOTO)) {
    const hub =
      inLocale(services, locale)[service]?.hub ?? services[service].hub;
    images.push({
      html: page(servicePhoto, [hub.title, hub.titleHighlight], stats),
      out: app(`public/og/${service}${suffix}.png`),
    });
  }
}

await renderOgImages(images);
