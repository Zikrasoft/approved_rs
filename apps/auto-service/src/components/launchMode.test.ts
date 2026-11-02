import type { Fitment } from '@podbor/catalog-contract';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { builtinEnvironments } from 'vitest/environments';
import type { PartPageEntry } from '@/utils/catalogueSnapshot';
import CategoryPage from '../pages/[locale]/parts/c/[slug]/[...page].astro';
import ThanksPage from '../pages/[locale]/thanks/[...variant].astro';
import FitLine from './FitLine.astro';
import FittedPart from './FittedPart.astro';
import InquiryLink from './InquiryLink.astro';
import LineItem from './LineItem.astro';
import PartStickyCta from './PartStickyCta.astro';
import PartThumb from './PartThumb.astro';
import PartsInquiryModal from './PartsInquiryModal.astro';

let container: AstroContainer;
let jsdom: Awaited<ReturnType<typeof builtinEnvironments.jsdom.setup>>;

beforeAll(async () => {
  container = await AstroContainer.create();
  jsdom = await builtinEnvironments.jsdom.setup(globalThis, {});
});

afterAll(() => jsdom.teardown(globalThis));

afterEach(() => vi.unstubAllEnvs());

const render = async (
  component: AstroComponentFactory,
  props: Record<string, unknown> = {},
  path = '/ru/parts/',
  params?: Record<string, string | undefined>,
) => {
  const html = await container.renderToString(component, {
    props,
    params,
    request: new Request(`https://carlab.rs${path}`),
  });
  return new DOMParser().parseFromString(html, 'text/html');
};

const openShop = () => vi.stubEnv('SHOP_OPEN', 'true');
const text = (node: ParentNode) =>
  node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const classes = (element: Element | null) =>
  element ? element.className.split(/\s+/) : [];

const fit: Fitment = {
  id: 'fit_1',
  part_id: 'part_1',
  vehicle_id: 'veh_1',
  quantity: 1,
  axle: 'front',
  side: null,
  production_from: null,
  production_to: null,
  gearbox: null,
  steering: null,
  note: null,
  translations: null,
};

const page = (overrides: Partial<PartPageEntry> = {}): PartPageEntry => ({
  id: 'pi_hu816x',
  type: 'manufacturer-number',
  value: 'HU 816 x',
  normalized_value: 'HU816X',
  superseded: false,
  brand: { name: 'MANN-FILTER', slug: 'mann-filter' },
  images: [],
  slug: 'mann-filter-hu816x',
  part: {
    id: 'part_1',
    name: 'Масляный фильтр BMW B47/B48 с уплотнительным кольцом',
    description: null,
    translations: null,
    replaced_by: null,
    category_id: null,
    attributes: {},
    installation_price: null,
  },
  equivalents: [],
  offers: [],
  supplier_data: { cross_references: [], applicability: [], images: [] },
  indexable: true,
  priceOnRequest: true,
  category: null,
  fits: [],
  requirementCars: [],
  kitCars: [],
  ...overrides,
});

describe('a list thumbnail of a category illustration', () => {
  const illustration = { src: '/pads.webp', illustration: true };

  it('carries no visible caption, only a screen-reader label', async () => {
    const doc = await render(PartThumb, { thumb: illustration });
    expect(doc.querySelector('part-image')?.hasAttribute('title')).toBe(false);
    expect(text(doc.querySelector('.sr-only')!)).toBe('иллюстрация');
  });

  it('is softened, never greyed out', async () => {
    const doc = await render(PartThumb, { thumb: illustration });
    expect(classes(doc.querySelector('img'))).toContain('opacity-80');
    expect(classes(doc.querySelector('img'))).not.toContain('grayscale');
  });

  it('leaves a real photo at full strength', async () => {
    const doc = await render(PartThumb, {
      thumb: { src: '/hu816x.webp', illustration: false },
    });
    expect(classes(doc.querySelector('img'))).not.toContain('opacity-80');
    expect(doc.querySelector('.sr-only')).toBeNull();
  });
});

describe('a fitment line', () => {
  it('names no quantity while the shop is closed', async () => {
    const doc = await render(FitLine, { fit });
    expect(text(doc.body)).toBe('передняя ось');
    expect(doc.querySelector('.spec')).toBeNull();
  });

  it('names the quantity once the shop is open', async () => {
    openShop();
    const doc = await render(FitLine, { fit });
    expect(text(doc.querySelector('.spec')!)).toBe('1 шт.');
  });

  it('leaves the quantity out when the caller says so', async () => {
    openShop();
    const doc = await render(FitLine, { fit, quantity: false });
    expect(text(doc.body)).toBe('передняя ось');
  });
});

describe('a fitted part row', () => {
  const props = {
    pages: [page()],
    name: 'Тормозные колодки',
    quantity: '1 шт.',
  };

  it('names no quantity while the shop is closed', async () => {
    const doc = await render(FittedPart, { ...props, specs: 'передние' });
    expect(text(doc.body)).not.toContain('шт.');
    expect(text(doc.querySelector('p.spec')!)).toBe('передние');
  });

  it('shows the quantity beside the price once the shop is open', async () => {
    openShop();
    const doc = await render(FittedPart, props);
    expect(text(doc.body)).toContain('1 шт.');
    expect(doc.querySelector('p.spec')).toBeNull();
  });
});

describe('a kit line', () => {
  const kit = {
    variant: 'kit',
    name: 'Моторное масло',
    href: '/ru/parts/p/castrol-15669e/',
    number: 'Castrol 15669E',
    quantity: '1 шт.',
  };

  it('puts the quantity after the number while the shop is closed', async () => {
    const doc = await render(LineItem, kit);
    expect(text(doc.querySelector('[data-number]')!)).toBe(
      'Castrol 15669E, 1 шт.',
    );
    expect(doc.querySelector('[data-quantity]')).toBeNull();
  });

  it('shows the bare number when the kit names no quantity', async () => {
    const doc = await render(LineItem, { ...kit, quantity: undefined });
    expect(text(doc.querySelector('[data-number]')!)).toBe('Castrol 15669E');
  });

  it('keeps the quantity under the price once the shop is open', async () => {
    openShop();
    const doc = await render(LineItem, kit);
    expect(text(doc.querySelector('[data-number]')!)).toBe('Castrol 15669E');
    expect(text(doc.querySelector('[data-quantity]')!)).toBe('1 шт.');
  });

  it('leaves a cart line its quantity column', async () => {
    const doc = await render(LineItem, { ...kit, variant: 'readonly' });
    expect(text(doc.querySelector('[data-quantity]')!)).toBe('1 шт.');
  });
});

describe('the closing inquiry on a listing', () => {
  it('is the primary action and hides the header request while in view', async () => {
    const doc = await render(InquiryLink, { topic: 'Масляные фильтры' });
    const button = doc.querySelector('.card a.btn')!;
    expect(classes(button)).toContain('btn-primary');
    expect(button.closest('[data-contact-cta]')).not.toBeNull();
  });

  it('stays a plain text link once the shop is open', async () => {
    openShop();
    const doc = await render(InquiryLink, { topic: 'Масляные фильтры' });
    expect(doc.querySelector('.card')).toBeNull();
    expect(doc.querySelector('[data-contact-cta]')).toBeNull();
  });
});

describe('the parts inquiry modal', () => {
  it('says what happens next under its heading, with no time promise', async () => {
    const doc = await render(PartsInquiryModal);
    const heading = doc.querySelector('dialog h2')!;
    const note = doc.querySelector('dialog .overflow-y-auto > p')!;
    expect(text(heading)).toBe('Заявка на запчасти');
    expect(text(note)).toBe(
      'Проверим совместимость, назовем цену и срок и свяжемся удобным вам способом.',
    );
  });
});

describe('the sticky part bar while the shop is closed', () => {
  it('wraps the whole part name onto two lines instead of cutting it', async () => {
    const doc = await render(
      PartStickyCta,
      { page: page(), target: 'order' },
      '/ru/parts/p/mann-filter-hu816x/',
    );
    const name = [...doc.querySelectorAll('span')].findLast(
      (span) =>
        text(span) === 'Масляный фильтр BMW B47/B48 с уплотнительным кольцом',
    )!;
    expect(classes(name)).toContain('line-clamp-2');
    expect(classes(name)).not.toContain('truncate');
  });
});

describe('the thanks page', () => {
  const thanks = (variant?: string) =>
    render(
      ThanksPage as unknown as AstroComponentFactory,
      {},
      variant ? `/ru/thanks/${variant}/` : '/ru/thanks/',
      {
        locale: 'ru',
        variant,
      },
    );

  it('offers no service booking bar after a parts inquiry', async () => {
    const doc = await thanks('parts');
    expect(doc.body.hasAttribute('data-sticky-bar')).toBe(false);
  });

  it('keeps the contact bar after a service lead', async () => {
    const doc = await thanks();
    expect(doc.body.hasAttribute('data-sticky-bar')).toBe(true);
  });
});

describe('a category page', () => {
  const category = {
    id: 'cat_suspension',
    slug: 'suspension',
    name: 'Подвеска и рулевое',
    text: 'От стука в подвеске до замены рулевых наконечников.',
    translations: null,
    maintenance_kit: false,
    kit_rank: 0,
    service_label: null,
    service_price: null,
    service_note: null,
    installation_price: null,
    image: null,
    fields: [],
    pages: [],
  };

  const offer = 'Пришлите VIN или номер, и мы назовем цену и срок.';
  const categoryPage = async (pages: PartPageEntry[]) => {
    const doc = await render(
      CategoryPage,
      {
        category: { ...category, pages },
        listing: { number: 1, count: pages.length ? 2 : 1, pages },
      },
      '/ru/parts/c/suspension/',
      { locale: 'ru', slug: 'suspension' },
    );
    return { doc, copy: [...doc.querySelectorAll('main p')].map(text) };
  };

  it('reads the lead first, then the offer that leads into the form, when empty', async () => {
    const { copy } = await categoryPage([]);
    const lead = copy.lastIndexOf(category.text);
    expect(lead).toBeGreaterThan(-1);
    expect(copy.indexOf(offer)).toBeGreaterThan(lead);
  });

  it('lists its parts and makes no offer once it has some', async () => {
    const { doc, copy } = await categoryPage([page()]);
    expect(
      doc.querySelector('a[href="/ru/parts/p/mann-filter-hu816x/"]'),
    ).not.toBeNull();
    expect(copy).not.toContain(offer);
    expect(
      doc.querySelector('a[href="/ru/parts/c/suspension/2/"]'),
    ).not.toBeNull();
  });
});
