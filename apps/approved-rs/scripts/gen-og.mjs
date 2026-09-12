import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '../public');

const W = 1200;
const H = 630;

function renderSvg({ eyebrow, tagline, subtagline }) {
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
    letter-spacing="4">${eyebrow}</text>

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
  console.log(
    `✓ saved (${(buf.length / 1024).toFixed(0)} KB) → ${outPath.replace(PUBLIC, 'public')}`,
  );
}

// Locale suffix on the filename: none for ru (default/backward-compatible
// path referenced as a fallback), '-en'/'-sr'/'-es'/'-de' for the others.
const LOCALE_SUFFIX = { ru: '', en: '-en', sr: '-sr', es: '-es', de: '-de' };

const EYEBROW = {
  ru: 'АВТОПОДБОР · ДОСТАВКА · ЕВРОПА',
  en: 'CAR SOURCING · DELIVERY · EUROPE',
  sr: 'ODABIR VOZILA · DOSTAVA · EVROPA',
  es: 'BÚSQUEDA DE AUTOS · ENTREGA · EUROPA',
  de: 'FAHRZEUGBESCHAFFUNG · LIEFERUNG · EUROPA',
};

const DEFAULT_SUB = {
  ru: 'Германия · Испания · Сербия · Полностью удалённо, через Telegram',
  en: 'Germany · Spain · Serbia · Fully remote, over Telegram',
  sr: 'Nemačka · Španija · Srbija · Potpuno na daljinu, preko Telegrama',
  es: 'Alemania · España · Serbia · Totalmente remoto, por Telegram',
  de: 'Deutschland · Spanien · Serbien · Komplett aus der Ferne, über Telegram',
};

const DEFAULT_TAGLINE = {
  ru: 'Подберём и доставим автомобиль из Европы',
  en: "We'll source and deliver your car from Europe",
  sr: 'Pronaći ćemo i dovesti vaše vozilo iz Evrope',
  es: 'Buscamos y te entregamos tu auto desde Europa',
  de: 'Wir suchen und liefern Ihr Auto aus Europa',
};

const SERVICE_VARIANTS = {
  ru: {
    'vehicle-sourcing': 'Подберём, проверим и доставим автомобиль под ключ',
    'vehicle-buyback': 'Срочный выкуп авто на иностранных номерах',
    'vehicle-inspection': 'Независимая проверка перед покупкой',
    'auto-service-belgrade': 'Ремонт и обслуживание автомобилей в Белграде',
  },
  en: {
    'vehicle-sourcing':
      "We'll source, inspect, and deliver your car, fully turnkey",
    'vehicle-buyback': 'Urgent car buyback on foreign plates',
    'vehicle-inspection': 'Independent inspection before you buy',
    'auto-service-belgrade': 'Car repair and maintenance in Belgrade',
  },
  sr: {
    'vehicle-sourcing':
      'Pronalazimo, proveravamo i dovozimo vozilo, ključ u ruke',
    'vehicle-buyback': 'Hitan otkup vozila na stranim tablicama',
    'vehicle-inspection': 'Nezavisna provera pre kupovine',
    'auto-service-belgrade': 'Popravka i održavanje vozila u Beogradu',
  },
  es: {
    'vehicle-sourcing':
      'Buscamos, inspeccionamos y entregamos tu auto, todo incluido',
    'vehicle-buyback': 'Compra urgente de autos con matrícula extranjera',
    'vehicle-inspection': 'Inspección independiente antes de comprar',
    'auto-service-belgrade': 'Reparación y mantenimiento de autos en Belgrado',
  },
  de: {
    'vehicle-sourcing':
      'Wir suchen, prüfen und liefern Ihr Auto — schlüsselfertig',
    'vehicle-buyback':
      'Dringender Ankauf von Autos mit ausländischem Kennzeichen',
    'vehicle-inspection': 'Unabhängige Prüfung vor dem Kauf',
    'auto-service-belgrade': 'Reparatur und Wartung von Autos in Belgrad',
  },
};

for (const locale of ['ru', 'en', 'sr', 'es', 'de']) {
  const suffix = LOCALE_SUFFIX[locale];

  await renderOg(join(PUBLIC, `og${suffix}.png`), {
    eyebrow: EYEBROW[locale],
    tagline: DEFAULT_TAGLINE[locale],
    subtagline: DEFAULT_SUB[locale],
  });

  mkdirSync(join(PUBLIC, 'og'), { recursive: true });
  for (const [service, tagline] of Object.entries(SERVICE_VARIANTS[locale])) {
    await renderOg(join(PUBLIC, 'og', `${service}${suffix}.png`), {
      eyebrow: EYEBROW[locale],
      tagline,
      subtagline: DEFAULT_SUB[locale],
    });
  }
}
