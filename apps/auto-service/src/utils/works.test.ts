import { describe, it, expect } from 'vitest';
import { article } from '@/components/articleFixture';
import type { PartCard } from './partEntry';
import {
  overviewConflicts,
  workshopMakePages,
  featuredWorks,
  localizedWork,
  makeGroup,
  makesOf,
  publishedWorks,
  servicePhoto,
  sharedMakes,
  sourcedParts,
  sourcingWorks,
  titleNamesCar,
  workLeadService,
  type Work,
} from './works';

function makeWork(
  overrides: Partial<Work['data']> = {},
  body = 'RU body',
): Work {
  return {
    id: 'bmw-x5',
    body,
    data: {
      title: 'BMW X5 — замена сцепления',
      car: 'BMW X5',
      servicesApplied: [],
      parts: [],
      image: { src: '/image.jpg' },
      gallery: [],
      date: new Date('2026-01-01'),
      published: true,
      ...overrides,
    },
  } as unknown as Work;
}

describe('localizedWork', () => {
  it('returns the ru source for the default locale', () => {
    const work = makeWork({
      translations: { en: { title: 'EN', body: 'EN body' } },
    });
    expect(localizedWork(work, 'ru')).toEqual({
      title: 'BMW X5 — замена сцепления',
      body: 'RU body',
      car: 'BMW X5',
    });
  });

  it('returns the translation when one exists', () => {
    const work = makeWork({
      translations: {
        en: { title: 'BMW X5 clutch replacement', body: 'EN body' },
      },
    });
    expect(localizedWork(work, 'en')).toEqual({
      title: 'BMW X5 clutch replacement',
      body: 'EN body',
      car: 'BMW X5',
    });
  });

  it('falls back to ru when the locale has no translation at all', () => {
    expect(localizedWork(makeWork(), 'sr').title).toBe(
      'BMW X5 — замена сцепления',
    );
  });

  it('falls back to ru rather than rendering a half-written translation', () => {
    const work = makeWork({
      translations: { sr: { title: 'BMW X5 zamena kvačila', body: '   ' } },
    });
    expect(localizedWork(work, 'sr')).toEqual({
      title: 'BMW X5 — замена сцепления',
      body: 'RU body',
      car: 'BMW X5',
    });
  });

  it('prefers the translated car when the locale has one', () => {
    const work = makeWork({
      car: 'Обслуживание тормозной системы',
      translations: {
        sr: {
          title: 'Servis kočionog sistema',
          body: 'SR body',
          car: 'Servis kočionog sistema',
        },
      },
    });
    expect(localizedWork(work, 'sr').car).toBe('Servis kočionog sistema');
  });

  it('falls back to the source car when the translation omits it', () => {
    const work = makeWork({
      translations: { sr: { title: 'SR title', body: 'SR body' } },
    });
    expect(localizedWork(work, 'sr')).toEqual({
      title: 'SR title',
      body: 'SR body',
      car: 'BMW X5',
    });
  });

  it('falls back to the source car when the whole translations block is absent', () => {
    expect(localizedWork(makeWork(), 'sr').car).toBe('BMW X5');
  });
});

describe('publishedWorks', () => {
  it('drops unpublished entries', () => {
    const works = [
      makeWork({ published: false }),
      makeWork({ published: true }),
    ];
    expect(publishedWorks(works)).toHaveLength(1);
  });

  it('never lists a Work without a photo', () => {
    expect(publishedWorks([makeWork({ image: undefined })])).toEqual([]);
  });

  it('sorts newest first', () => {
    const older = makeWork({ date: new Date('2025-01-01') });
    const newer = makeWork({ date: new Date('2026-06-01') });
    expect(publishedWorks([older, newer])[0]).toBe(newer);
  });

  it('does not mutate the input array', () => {
    const older = makeWork({ date: new Date('2025-01-01') });
    const newer = makeWork({ date: new Date('2026-06-01') });
    const input = [older, newer];
    publishedWorks(input);
    expect(input[0]).toBe(older);
  });
});

describe('featuredWorks', () => {
  const work = (date: string, featured: boolean) =>
    makeWork({ date: new Date(date), featured });

  it('leads with the featured Works, each group newest first', () => {
    const plainNew = work('2026-09-01', false);
    const plainOld = work('2026-01-01', false);
    const pickedNew = work('2026-06-01', true);
    const pickedOld = work('2025-06-01', true);
    expect(featuredWorks([plainOld, pickedOld, plainNew, pickedNew])).toEqual([
      pickedNew,
      pickedOld,
      plainNew,
      plainOld,
    ]);
  });

  it('keeps the rules of the published list', () => {
    expect(
      featuredWorks([
        makeWork({ featured: true, published: false }),
        makeWork({ featured: true, image: undefined }),
      ]),
    ).toEqual([]);
  });
});

describe('titleNamesCar', () => {
  it('is true when the title already opens with the car, in any case', () => {
    expect(titleNamesCar('BMW X3: масло в двигателе', 'BMW X3')).toBe(true);
    expect(titleNamesCar('Seat Leon: ГРМ', 'SEAT LEON')).toBe(true);
  });

  it('is false when the title names the job first', () => {
    expect(titleNamesCar('Замена масла в DSG на Skoda', 'Skoda Octavia')).toBe(
      false,
    );
  });
});

const partCard = (brand: string, value: string, normalized: string) =>
  ({
    slug: `${brand.toLowerCase()}-${normalized.toLowerCase()}`,
    value,
    normalized_value: normalized,
    brand: { name: brand, slug: brand.toLowerCase() },
  }) as unknown as PartCard;

describe('sourcedParts', () => {
  const slugs = new Set(['mann-filter-hu816x']);

  it('links a Part that has a Part page, matching brand and number loosely', () => {
    const work = makeWork({
      parts: [{ brand: 'Mann-Filter', number: 'hu-816 x' }],
    });
    expect(sourcedParts(work, slugs)).toEqual([
      { brand: 'Mann-Filter', number: 'hu-816 x', slug: 'mann-filter-hu816x' },
    ]);
  });

  it('shows a Part without a page as brand and number only', () => {
    const work = makeWork({ parts: [{ brand: 'Bosch', number: '0 986 4' }] });
    expect(sourcedParts(work, slugs)).toEqual([
      { brand: 'Bosch', number: '0 986 4', slug: null },
    ]);
  });

  it('does not link the same number under another brand', () => {
    const work = makeWork({ parts: [{ brand: 'Bosch', number: 'HU816X' }] });
    expect(sourcedParts(work, slugs)[0].slug).toBeNull();
  });

  it('shows a number with no letters or digits as text', () => {
    const work = makeWork({ parts: [{ brand: 'Mann-Filter', number: '--' }] });
    expect(sourcedParts(work, slugs)[0].slug).toBeNull();
  });

  it('renders every Part as text when the catalogue is missing', () => {
    const work = makeWork({ parts: [{ brand: 'Bosch', number: '1' }] });
    expect(sourcedParts(work, new Set())).toEqual([
      { brand: 'Bosch', number: '1', slug: null },
    ]);
  });
});

describe('sourcingWorks', () => {
  it('lists the published Works that sourced a Part page', () => {
    const page = partCard('MANN-FILTER', 'HU 816 x', 'HU816X');
    const sourced = makeWork({
      parts: [{ brand: 'mann-filter', number: 'HU816X' }],
    });
    const hidden = makeWork({
      published: false,
      parts: [{ brand: 'mann-filter', number: 'HU816X' }],
    });
    const other = makeWork({ parts: [{ brand: 'Bosch', number: 'HU816X' }] });
    expect(sourcingWorks([other, hidden, sourced], page)).toEqual([sourced]);
  });
});

describe('workLeadService', () => {
  it('posts Parts sourcing wherever it sits in servicesApplied', () => {
    const work = makeWork({
      servicesApplied: ['servicing', 'vin-parts-inquiry'],
    });
    expect(workLeadService(work)).toBe('vin-parts-inquiry');
  });

  it('posts the first applied service on any other Work', () => {
    const work = makeWork({ servicesApplied: ['diagnostics', 'servicing'] });
    expect(workLeadService(work)).toBe('diagnostics');
  });

  it('posts no service when none is applied', () => {
    expect(workLeadService(makeWork())).toBeUndefined();
  });
});

describe('makeGroup', () => {
  it('keys a Work by the Make chosen for it', () => {
    expect(makeGroup(makeWork({ make: 'mercedes-benz' }))).toBe(
      'mercedes-benz',
    );
  });

  it('leaves a Work without a Make out of every group', () => {
    expect(makeGroup(makeWork({ car: 'BMW X5' }))).toBe(undefined);
  });
});

describe('the makes of a list of Works', () => {
  const works = [
    makeWork({ make: 'skoda', car: 'Octavia' }),
    makeWork({ make: 'bmw' }),
    makeWork({ make: 'audi' }),
    makeWork({ make: 'skoda' }),
    makeWork({ make: 'bmw' }),
    makeWork({ make: 'audi' }),
    makeWork({ make: 'volkswagen' }),
    makeWork({ car: 'Обслуживание тормозов' }),
  ];

  it('offers a chip only for a Make two or more Works share, by name', () => {
    expect(sharedMakes(works)).toEqual([
      { label: 'Audi', group: 'audi' },
      { label: 'BMW', group: 'bmw' },
      { label: 'Škoda', group: 'skoda' },
    ]);
  });

  it('names every Make at least one Work carries', () => {
    expect(makesOf(works).map(({ slug, name }) => [slug, name])).toEqual([
      ['audi', 'Audi'],
      ['bmw', 'BMW'],
      ['skoda', 'Škoda'],
      ['volkswagen', 'Volkswagen'],
    ]);
  });
});

describe('servicePhoto', () => {
  const work = (id: string, src: string) =>
    ({ ...makeWork({ image: { src } as never }), id }) as Work;
  const workshop = { image: { src: '/bay.jpg' } as never, alt: 'Цех CarLab' };

  it('takes the cover of the Work picked for the service, as decoration', () => {
    const works = [work('bmw-x3', '/x3.jpg'), work('seat-leon', '/leon.jpg')];

    expect(servicePhoto('diagnostics', works, workshop)).toEqual({
      image: { src: '/x3.jpg' },
      alt: '',
    });
  });

  it('shows the workshop where no Work cover fits the service', () => {
    const works = [work('velikij-servis-zamena-grm', '/grm.jpg')];

    expect(servicePhoto('engine-gearbox', works, workshop)).toBe(workshop);
    expect(servicePhoto('bodywork-painting', [], workshop)).toBe(workshop);
    expect(servicePhoto('pre-purchase-inspection', [], workshop)).toBe(
      workshop,
    );
  });

  it('has no photo for parts sourcing or once the picked Work is unpublished', () => {
    const hidden = { ...makeWork({ published: false }), id: 'bmw-x3' } as Work;

    expect(
      servicePhoto('vin-parts-inquiry', [work('bmw-x3', '/x3.jpg')], workshop),
    ).toBe(undefined);
    expect(servicePhoto('diagnostics', [hidden], workshop)).toBe(undefined);
  });
});

describe('workshopMakePages', () => {
  const fitted = (slug: string, name: string) => ({
    make: { slug, name },
    parts: 3,
    hub: true,
    categories: [],
  });

  const catalogue = [
    { slug: 'alfa-romeo', name: 'Alfa Romeo', show_on_site: null },
    { slug: 'audi', name: 'Audi', show_on_site: false },
    { slug: 'daf', name: 'DAF', show_on_site: false },
  ];
  const mini = { slug: 'mini', name: 'MINI', show_on_site: true };
  const activeSlugs = (...args: Parameters<typeof workshopMakePages>) =>
    workshopMakePages(...args).map(({ make }) => make.slug);

  it('gives a page to a Make with a published Work, and its Parts on it', () => {
    const pages = workshopMakePages(
      [makeWork({ make: 'audi' })],
      [],
      [fitted('audi', 'Audi'), fitted('daf', 'DAF')],
      catalogue,
    );

    expect(pages.map(({ make }) => make.slug)).toEqual(['audi']);
    expect(pages[0].parts).toEqual([fitted('audi', 'Audi')]);
  });

  it('gives a page to a Make with only a published Article', () => {
    expect(
      activeSlugs([], [article({ make: 'alfa-romeo' })], [], catalogue),
    ).toEqual(['alfa-romeo']);
  });

  it('gives a page to a Make flagged for the site with nothing else', () => {
    expect(activeSlugs([], [], [], [...catalogue, mini])).toEqual(['mini']);
  });

  it('gives no page to a Make with only Parts, an unpublished Work or nothing', () => {
    expect(
      activeSlugs(
        [makeWork({ make: 'audi', published: false })],
        [],
        [fitted('daf', 'DAF')],
        catalogue,
      ),
    ).toEqual([]);
  });
});

describe('overviewConflicts', () => {
  it('names a Make with more than one overview and the one its page uses', () => {
    const pages = workshopMakePages(
      [],
      [
        article({
          id: 'first',
          make: 'bmw',
          overview: true,
          date: new Date('2026-01-01'),
        }),
        article({
          id: 'second',
          make: 'bmw',
          overview: true,
          date: new Date('2026-03-01'),
        }),
        article({ id: 'audi', make: 'audi', overview: true }),
      ],
      [],
    );

    expect(overviewConflicts(pages)).toEqual([
      'Make bmw has 2 overview Articles (second, first); using second',
    ]);
  });
});
