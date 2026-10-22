import { existsSync, readFileSync } from 'node:fs';

import { z } from 'zod';

import type {
  SupplierAdapter,
  SupplierArticle,
  SupplierQuote,
} from './adapter';

const DEMO_PAGE_SIZE = 3;
const DEMO_LOCATION = 'Beograd';

type DemoArticle = SupplierArticle & {
  offer: Omit<SupplierQuote, 'article_id'>;
};

export type DemoSupplier = {
  name: string;
  markup_percentage: number;
  categories: Record<string, string>;
  spellings: Record<string, string>;
  articles: DemoArticle[];
};

const offer = (
  cost_price: number,
  quantity: number,
  lead_time_days: number,
  currency = 'RSD',
): DemoArticle['offer'] => ({
  cost_price,
  currency,
  stock: [{ location: DEMO_LOCATION, quantity }],
  lead_time_days,
});

export const DEMO_SUPPLIERS: DemoSupplier[] = [
  {
    name: 'Demo Intercars',
    markup_percentage: 20,
    categories: {
      'IC-OIL': 'engine-oil',
      'IC-FILTER': 'oil-filters',
      'IC-AIR': 'maintenance-consumables',
      'IC-BRAKE': 'brake-pads',
      'IC-BATT': 'batteries',
    },
    spellings: {
      MANN: 'mann-filter',
      'MANN-FILTER': 'mann-filter',
      MAHLE: 'mahle',
      ATE: 'ate',
      TRW: 'trw',
      CASTROL: 'castrol',
      BMW: 'bmw',
      VARTA: 'varta',
      BOSCH: 'bosch',
      EXIDE: 'exide',
    },
    articles: [
      {
        article_id: 'IC-1001',
        brand: 'MANN',
        number: 'HU816X',
        name: 'Oil filter HU 816 x',
        category: 'IC-FILTER',
        cross_references: [
          { brand: 'BMW', number: '11 42 8 575 211' },
          { brand: 'MAHLE', number: 'OX 404D' },
        ],
        applicability: [
          'BMW 3 F30 320d B47D20 2015-2019',
          'BMW 3 F30 320i B48B20 2015-2019',
          'BMW 5 G30 520d B47D20 2017-2023',
        ],
        offer: offer(1000, 12, 1),
      },
      {
        article_id: 'IC-1002',
        brand: 'MANN-FILTER',
        number: 'hu 6020 z',
        name: 'Oil filter HU 6020 z',
        category: 'IC-FILTER',
        offer: offer(1400, 0, 5),
      },
      {
        article_id: 'IC-1003',
        brand: 'ATE',
        number: '13.0460-2786.2',
        name: 'Brake pad set, front',
        category: 'IC-BRAKE',
        applicability: ['BMW 3 F30 320d', 'BMW 3 F30 320i'],
        offer: offer(5500, 3, 2),
      },
      {
        article_id: 'IC-1004',
        brand: 'TRW',
        number: 'GDB 2033',
        name: 'Brake pad set, front, sport',
        category: 'IC-BRAKE',
        offer: offer(4800, 6, 1),
      },
      {
        article_id: 'IC-1005',
        brand: 'CASTROL',
        number: '15669E',
        name: 'Castrol EDGE 5W-30 LL 5 l',
        category: 'IC-OIL',
        applicability: [
          'BMW Longlife-04',
          'Mercedes-Benz 229.51',
          'BMW 3 F30 320d B47D20 2015-2019',
        ],
        offer: offer(3900, 20, 0),
      },
      {
        article_id: 'IC-1006',
        brand: 'MAHLE',
        number: 'OX-404-D',
        name: 'Oil filter OX 404D',
        category: 'IC-FILTER',
        offer: offer(9, 40, 0, 'EUR'),
      },
      {
        article_id: 'IC-1007',
        brand: 'NONAME PARTS',
        number: 'NN-1',
        name: 'Oil filter, no-name',
        category: 'IC-FILTER',
        offer: offer(300, 100, 0),
      },
      {
        article_id: 'IC-1008',
        brand: 'BMW',
        number: '61 61 0 000 001',
        name: 'Wiper blade set',
        category: 'IC-WIPER',
        offer: offer(2500, 5, 1),
      },
      {
        article_id: 'IC-1009',
        brand: 'MANN',
        number: 'C 30 005',
        name: 'Air filter C 30 005',
        category: 'IC-AIR',
        cross_references: [{ brand: 'BMW', number: '13 71 8 577 170' }],
        offer: offer(1700, 9, 1),
      },
      {
        article_id: 'IC-1010',
        brand: 'BMW',
        number: '11.42.8.575.211',
        name: 'Oil filter element',
        category: 'IC-FILTER',
        offer: offer(1542, 4, 0),
      },
      {
        article_id: 'IC-1011',
        brand: 'TRW',
        number: 'GDB1234',
        name: 'Brake pad set, rear',
        category: 'IC-BRAKE',
        offer: offer(3600, 2, 3),
      },
      {
        article_id: 'IC-1012',
        brand: 'VARTA',
        number: '580901080',
        name: 'Battery Silver Dynamic AGM G14 80Ah 800A',
        category: 'IC-BATT',
        cross_references: [{ brand: 'EXIDE', number: 'EK800' }],
        applicability: ['BMW 3 F30 320d 2015-2019', 'BMW 5 G30 520d 2017-2023'],
        offer: offer(14500, 6, 1),
      },
      {
        article_id: 'IC-1013',
        brand: 'BOSCH',
        number: '0 092 S5A 130',
        name: 'Battery S5 A13 AGM 95Ah 850A',
        category: 'IC-BATT',
        offer: offer(19800, 0, 4),
      },
      {
        article_id: 'IC-1014',
        brand: 'EXIDE',
        number: 'EK700',
        name: 'Battery AGM EK700 70Ah 760A',
        category: 'IC-BATT',
        offer: offer(13200, 3, 2),
      },
      {
        article_id: 'IC-1015',
        brand: 'VARTA',
        number: '580 500 080',
        name: 'Battery Blue Dynamic EFB N80 80Ah 800A',
        category: 'IC-BATT',
        offer: offer(11900, 5, 1),
      },
    ],
  },
  {
    name: 'Demo Autodelovi',
    markup_percentage: 10,
    categories: {
      'AD-10': 'oil-filters',
      'AD-20': 'brake-pads',
    },
    spellings: {
      'Mann Filter': 'mann-filter',
      'MAHLE ORIGINAL': 'mahle',
      Ate: 'ate',
      TEXTAR: 'textar',
      MB: 'mercedes-benz',
    },
    articles: [
      {
        article_id: 'AD-2001',
        brand: 'Mann Filter',
        number: 'HU 816 X',
        name: 'Filter ulja HU 816 x',
        category: 'AD-10',
        offer: offer(900, 0, 2),
      },
      {
        article_id: 'AD-2002',
        brand: 'Ate',
        number: '13046027862',
        name: 'Plocice kocnice prednje',
        category: 'AD-20',
        offer: offer(6000, 5, 0),
      },
      {
        article_id: 'AD-2003',
        brand: 'TEXTAR',
        number: '2459801',
        name: 'Plocice kocnice zadnje',
        category: 'AD-20',
        offer: offer(4000, 8, 1),
      },
      {
        article_id: 'AD-2004',
        brand: 'MB',
        number: 'A 654 180 01 00',
        name: 'Filter ulja OM654',
        category: 'AD-10',
        cross_references: [{ brand: 'MANN-FILTER', number: 'HU 6020 z' }],
        offer: offer(2000, 2, 1),
      },
      {
        article_id: 'AD-2005',
        brand: 'Mann Filter',
        number: 'HU6020Z',
        name: 'Filter ulja HU 6020 z',
        category: 'AD-10',
        offer: offer(1200, 7, 1),
      },
      {
        article_id: 'AD-2006',
        brand: 'Bosch',
        number: '3 397 007 460',
        name: 'Metlice brisaca',
        category: 'AD-99',
        offer: offer(2100, 4, 1),
      },
      {
        article_id: 'AD-2007',
        brand: 'MAHLE ORIGINAL',
        number: 'OX 404 D',
        name: 'Filter ulja OX 404D',
        category: 'AD-10',
        offer: offer(1100, 3, 2),
      },
    ],
  },
];

export const DEMO_SUPPLIER_IMAGES: Record<string, string> = {
  'IC-1001': 'oil-filter',
  'IC-1003': 'brake-pad',
  'IC-1005': 'oil-can',
  'IC-1012': 'battery',
};

export const demoSupplierImage = (articleId: string) =>
  `demo-supplier/${articleId.toLowerCase()}.webp`;

const overridesSchema = z.record(
  z.string(),
  z
    .object({
      cost_price: z.number().nonnegative(),
      stock: z.number().int().nonnegative(),
    })
    .partial()
    .strict(),
);

export type DemoOverrides = z.infer<typeof overridesSchema>;

export const readDemoOverrides = (path: string | undefined): DemoOverrides => {
  if (!path || !existsSync(path)) {
    return {};
  }
  return overridesSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
};

const quoteOf = (
  { article_id, offer: base }: DemoArticle,
  overrides: DemoOverrides,
): SupplierQuote => {
  const override = overrides[article_id] ?? {};
  return {
    article_id,
    ...base,
    cost_price: override.cost_price ?? base.cost_price,
    stock:
      override.stock === undefined
        ? base.stock
        : [{ location: DEMO_LOCATION, quantity: override.stock }],
  };
};

export const createDemoAdapter = (
  { name, articles }: DemoSupplier,
  overrides: () => DemoOverrides,
  fileUrl: string,
): SupplierAdapter => ({
  name,
  listCatalogue: async (cursor) => {
    const start = Number(cursor ?? 0);
    const end = start + DEMO_PAGE_SIZE;
    return {
      articles: articles.slice(start, end).map(({ offer: _, ...article }) => ({
        ...article,
        ...(DEMO_SUPPLIER_IMAGES[article.article_id] && {
          images: [`${fileUrl}/${demoSupplierImage(article.article_id)}`],
        }),
      })),
      next: end < articles.length ? String(end) : null,
    };
  },
  quote: async (articleIds) => {
    const current = overrides();
    return articles
      .filter(({ article_id }) => articleIds.includes(article_id))
      .map((article) => quoteOf(article, current));
  },
});

export const demoAdapters = (
  overridesPath: string | undefined,
  fileUrl: string,
) =>
  DEMO_SUPPLIERS.map((supplier) =>
    createDemoAdapter(
      supplier,
      () => readDemoOverrides(overridesPath),
      fileUrl,
    ),
  );
