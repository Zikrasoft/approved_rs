import { type CheerioAPI, load } from 'cheerio/slim';
import type { Page } from 'playwright';
import { z } from 'zod';

import type { SupplierArticle, VehicleFacts } from '../../suppliers/adapter';
import { imageUrls, parsedJson, words } from '../page-parsing';
import type { CrawledSite } from '../site';
import type { SitemapEntry } from '../sitemap';

export const BILSTEIN_FAMILIES = [
  'filter',
  'kočio',
  'kočni',
  'istrošenosti',
  'amortizer',
  'opruga šasije',
  'opružnu nogu',
  'rame',
  'ramena',
  'spon[ae]',
  'aksijalni zglob',
  'kugla(?!\\p{L})',
  'kuglasti zglob',
  'stabilizator',
  'odbojn',
  'manžetn[ae] upravljača',
  'svećic',
  'kaiš',
  'španer remena',
  'metlic',
];

const FAMILY = new RegExp(
  `(?:^|[\\s/-])(?:${BILSTEIN_FAMILIES.join('|')})`,
  'u',
);

const inFamily = (name: string) => FAMILY.test(words(name).toLowerCase());

const ORIGIN = 'https://partsfinder.bilsteingroup.com';
const APPLICATIONS = '#detail-page-applications';
const APPLICATIONS_DATA = 'data-bilstein-applications';
const ARTICLE_PAGE =
  /^https:\/\/partsfinder\.bilsteingroup\.com\/sr\/article\/(?:febi|SWAG|blueprint)\/[^/]+$/u;

const sitemapPage = ({ imageTitles }: SitemapEntry) =>
  imageTitles.some(inFamily);

const applicationsSchema = z.array(
  z.object({
    data: z.array(
      z.object({
        attributes: z.object({
          makeTitle: z.string(),
          modelTitle: z.string(),
          variantTitle: z.string(),
          engine: z.string().nullish(),
          engineCapacity: z.string().nullish(),
          csvFuelTypes: z.string().nullish(),
          body: z.string().nullish(),
          modelCodes: z.string().nullish(),
          variantId: z.number().int().nullish(),
        }),
        relationships: z
          .object({
            limitations: z.object({
              data: z.array(z.object({ id: z.string() })),
            }),
          })
          .optional(),
      }),
    ),
    included: z
      .array(
        z.object({
          id: z.string(),
          attributes: z.object({ criteria: z.string(), value: z.string() }),
        }),
      )
      .optional(),
  }),
);

const each = ($: CheerioAPI, selector: string) =>
  $(selector)
    .toArray()
    .map((node) => words($(node).text()))
    .filter(Boolean);

const imagesOf = ($: CheerioAPI) =>
  imageUrls(
    $('img[src*="/pf-article-details/"]')
      .toArray()
      .map((image) =>
        $(image)
          .attr('src')
          ?.replace('/pf-article-details/', '/pf-article-zoomed/'),
      ),
    { keepQuery: true },
  );

const attributesOf = ($: CheerioAPI) =>
  Object.fromEntries(
    $('.attributes-table tbody tr')
      .toArray()
      .map((row) => [
        words($(row).children('td.is-hidden-touch').text()),
        words(
          $(row).children('td:not(.is-hidden-touch)').children('span').text(),
        ),
      ])
      .filter(([name, value]) => name && value),
  );

const FUELS: Record<string, NonNullable<VehicleFacts['fuel']>> = {
  dizel: 'diesel',
  diesel: 'diesel',
  benzin: 'petrol',
  petrol: 'petrol',
  hibrid: 'hybrid',
  elektro: 'electric',
};

const BODIES: Record<string, NonNullable<VehicleFacts['body_style']>> = {
  limuzina: 'sedan',
  saloon: 'sedan',
  'kombi vozilo': 'touring',
  estate: 'touring',
  'kosa zadnja strana vozila': 'hatchback',
  hatchback: 'hatchback',
  kupe: 'coupe',
  coupe: 'coupe',
  cabriolet: 'convertible',
  'terensko vozilo': 'suv',
  'off-road vehicle': 'suv',
  'van (putničko vozilo)': 'van',
  'car derived van': 'van',
  'kutijasto vozilo': 'van',
  autobus: 'van',
};

const ENGINE_CODE_LIMIT = 'pogodno za kod motora';
const MODEL_YEARS = /\s+(\d{4})\s*-\s*(\d{4})?\s*$/u;
const CODES = /\s*\(([^)]+)\)/u;
const POWER = /(\d+)\s*kW/u;

const list = (text: string | null | undefined) =>
  (text ?? '').split(/\s*,\s*/u).filter(Boolean);

const bodyOf = (text: string | null | undefined) => {
  const styles = new Set(
    list(text).flatMap((body) => BODIES[body.toLowerCase()] ?? []),
  );
  return styles.size === 1 ? [...styles][0] : null;
};

const modelOf = (title: string) => {
  const years = MODEL_YEARS.exec(title);
  const model = title.replace(MODEL_YEARS, '');
  return {
    model: model.replace(CODES, '').trim(),
    codes: list(CODES.exec(model)?.[1]),
    year_from: years ? Number(years[1]) : null,
    year_to: years?.[2] ? Number(years[2]) : null,
  };
};

const vehiclesOf = ($: CheerioAPI): VehicleFacts[] => {
  const applications = applicationsSchema.safeParse(
    parsedJson($(`script[${APPLICATIONS_DATA}]`).text() || '[]'),
  );
  if (!applications.success) return [];
  return applications.data.flatMap(({ data, included = [] }) => {
    const limits = new Map(
      included.map(({ id, attributes }) => [id, attributes]),
    );
    return data.map(({ attributes, relationships }) => {
      const applied = (relationships?.limitations.data ?? []).flatMap(
        ({ id }) => limits.get(id) ?? [],
      );
      const engineLimit = applied.find(
        ({ criteria }) => criteria === ENGINE_CODE_LIMIT,
      );
      const { model, codes, year_from, year_to } = modelOf(
        attributes.modelTitle,
      );
      const modelCodes = list(attributes.modelCodes);
      return {
        make: attributes.makeTitle,
        model,
        variant: attributes.variantTitle.split(' - ')[0].trim(),
        chassis_codes: modelCodes.length ? modelCodes : codes,
        engine_codes: engineLimit
          ? list(engineLimit.value)
          : list(attributes.engine),
        displacement_cc: Number(attributes.engineCapacity) || null,
        power_kw: Number(POWER.exec(attributes.variantTitle)?.[1]) || null,
        fuel: FUELS[(attributes.csvFuelTypes ?? '').toLowerCase()] ?? null,
        body_style: bodyOf(attributes.body),
        year_from,
        year_to,
        notes: applied
          .filter((limit) => limit !== engineLimit)
          .map(({ criteria, value }) => `${criteria}: ${value}`),
        ...(attributes.variantId != null && {
          supplier_vehicle_id: String(attributes.variantId),
        }),
      };
    });
  });
};

const crossReferencesOf = ($: CheerioAPI) =>
  $('.detailpage-number-table tbody tr')
    .toArray()
    .flatMap((row) => {
      const [brand, numbers] = $(row)
        .children('td')
        .toArray()
        .map((cell) => words($(cell).text()));
      return (numbers ?? '')
        .split(' | ')
        .filter(Boolean)
        .map((number) => ({ brand, number }));
    });

const CRITERION = /^(.+?):\s*(.+)$/u;
const NEXT_CRITERION = /\s+(?=\p{Lu}[\p{Ll}\s]*:)/u;

const criteriaOf = (meta: string, makes: string[]): Record<string, string> => {
  const lead = ` odgovarajući za ${makes.join(', ')}`;
  const at = meta.indexOf(lead);
  if (at < 0) return {};
  return Object.fromEntries(
    meta
      .slice(at + lead.length)
      .split(NEXT_CRITERION)
      .map((part) => CRITERION.exec(part.trim()))
      .filter((pair) => pair !== null)
      .map((pair) => [pair[1], pair[2]]),
  );
};

const setContentsOf = ($: CheerioAPI) =>
  $('.repKitSol-div-padding tbody tr:has(td)')
    .toArray()
    .map((row) => {
      const cells = $(row)
        .children('td')
        .toArray()
        .map((cell) => $(cell));
      const [number, name, quantity] = [
        words(cells[0]?.find('strong').text() ?? ''),
        words(cells[1]?.text() ?? ''),
        words(cells[2]?.text() ?? ''),
      ];
      return `${quantity} x ${number} ${name}`;
    })
    .join('; ');

export const parseBilsteinArticle = (html: string): SupplierArticle | null => {
  const $ = load(html);
  const [brand, , name] = $('title').text().split(' | ').map(words);
  const app = $('#app');
  const number = words(app.attr('data-bg-number') ?? '');
  const brandPath = new URL(
    $('link[hreflang="sr"]').attr('href') ?? '',
    ORIGIN,
  ).pathname.split('/')[3];
  if (!brand || !name || !number || !brandPath || !inFamily(name)) return null;
  const crossReferences = crossReferencesOf($);
  const makes = [...new Set(crossReferences.map(({ brand }) => brand))];
  const specs = {
    ...criteriaOf(
      words($('meta[name="description"]').attr('content') ?? ''),
      makes,
    ),
    ...attributesOf($),
  };
  const contents = setContentsOf($);
  if (contents) specs['Sadržaj seta'] = contents;
  const description = each($, '.desc-bullet-points li').join('; ');
  return {
    article_id: `${brandPath}/${number}`,
    brand,
    number,
    name,
    category: name,
    ...(description && { description }),
    specs,
    cross_references: crossReferences,
    images: imagesOf($),
    vehicles: vehiclesOf($),
  };
};

const makesSchema = z.object({
  data: z.array(z.object({ attributes: z.object({ title: z.string() }) })),
});

const answer = async (page: Page, path: string, act: () => Promise<void>) => {
  const response = page.waitForResponse(
    (response) => new URL(response.url()).pathname === path,
  );
  await act();
  return (await response).json() as Promise<unknown>;
};

const openApplications = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  return answer(page, '/api/makes', () =>
    page
      .locator(`section:has(${APPLICATIONS}) > header`)
      .dispatchEvent('click'),
  );
};

export const collectApplications = async (page: Page) => {
  const makes = makesSchema.parse(await openApplications(page)).data;
  const section = page.locator(APPLICATIONS);
  const applications: unknown[] = [];
  for (const { attributes } of makes) {
    if (!(await section.locator('.makes').count())) {
      await section.locator('a.trigger').dispatchEvent('click');
    }
    applications.push(
      await answer(page, '/api/applications', () =>
        section
          .locator('.makes')
          .getByText(attributes.title, { exact: true })
          .dispatchEvent('click'),
      ),
    );
  }
  await page.evaluate(
    ([attribute, json]) => {
      const script = document.createElement('script');
      script.type = 'application/json';
      script.setAttribute(attribute, '');
      script.textContent = json;
      document.body.append(script);
    },
    [APPLICATIONS_DATA, JSON.stringify(applications)],
  );
};

export const bilstein: CrawledSite = {
  key: 'bilstein',
  name: 'bilstein group',
  origin: ORIGIN,
  sitemaps: [`${ORIGIN}/sitemaps/sr/sitemap-index.xml`],
  floorMs: 5000,
  fetchMode: 'browser',
  locale: 'sr-RS',
  waitFor: APPLICATIONS,
  interact: collectApplications,
  isPage: (url) => ARTICLE_PAGE.test(url),
  sitemapPage,
  parse: parseBilsteinArticle,
};
