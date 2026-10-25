import { type CheerioAPI, load } from 'cheerio/slim';
import type { Page } from 'playwright';
import { z } from 'zod';

import type { SupplierArticle } from '../../suppliers/adapter';
import type { CrawledSite } from '../site';

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
  'kugla$',
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

const words = (text: string) => text.replace(/\s+/gu, ' ').trim();

const inFamily = (name: string) => FAMILY.test(words(name).toLowerCase());

const ORIGIN = 'https://partsfinder.bilsteingroup.com';
const APPLICATIONS = '#detail-page-applications';
const APPLICATIONS_DATA = 'data-bilstein-applications';
const ARTICLE_PAGE =
  /^https:\/\/partsfinder\.bilsteingroup\.com\/sr\/article\/(?:febi|SWAG|blueprint)\/[^/]+$/u;

const sitemapPages = (xml: string) => {
  const $ = load(xml, { xml: true });
  return $('url')
    .toArray()
    .filter((url) =>
      $(url)
        .find('image\\:title')
        .toArray()
        .some((title) => inFamily($(title).text())),
    )
    .map((url) => $(url).children('loc').text().trim());
};

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

const parsedJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const each = ($: CheerioAPI, selector: string) =>
  $(selector)
    .toArray()
    .map((node) => words($(node).text()))
    .filter(Boolean);

const imagesOf = ($: CheerioAPI) => [
  ...new Set(
    $('img[src*="/pf-article-details/"]')
      .toArray()
      .map(
        (image) =>
          new URL(
            ($(image).attr('src') ?? '').replace(
              '/pf-article-details/',
              '/pf-article-zoomed/',
            ),
          ).href,
      ),
  ),
];

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

const applicabilityOf = ($: CheerioAPI) => {
  const applications = applicationsSchema.safeParse(
    parsedJson($(`script[${APPLICATIONS_DATA}]`).text() || '[]'),
  );
  if (!applications.success) return [];
  return applications.data.flatMap(({ data, included = [] }) => {
    const limits = new Map(
      included.map(({ id, attributes }) => [
        id,
        `${attributes.criteria}: ${attributes.value}`,
      ]),
    );
    return data.map(({ attributes, relationships }) =>
      [
        `${attributes.makeTitle} ${attributes.modelTitle} ${attributes.variantTitle}`,
        attributes.engine,
        attributes.engineCapacity && `${attributes.engineCapacity} ccm`,
        attributes.csvFuelTypes,
        attributes.body,
        ...(relationships?.limitations.data ?? []).map(({ id }) =>
          limits.get(id),
        ),
      ]
        .filter(Boolean)
        .join('; '),
    );
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
    applicability: applicabilityOf($),
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
  waitFor: APPLICATIONS,
  interact: collectApplications,
  isPage: (url) => ARTICLE_PAGE.test(url),
  sitemapPages,
  parse: parseBilsteinArticle,
};
