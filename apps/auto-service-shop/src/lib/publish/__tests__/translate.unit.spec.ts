import type CatalogModuleService from '../../../modules/catalog/service';
import { sha256Hex } from '@podbor/i18n/translate/core';

import { translateCatalogue } from '../translate';

type Row = { id: string; name: string; description: string | null };

const catalogueOf = (parts: Row[]) => {
  const updated: {
    id: string;
    translations: unknown;
    translated_from?: unknown;
  }[] = [];
  const none = async () => [];
  const fullReads: string[][] = [];
  const catalog = {
    translationSources: async (table: string) =>
      table === 'part'
        ? parts.map(({ id, ...source }) => ({ ...source, ids: [id] }))
        : [],
    listParts: async ({ id }: { id: string[] }) => {
      fullReads.push(id);
      return parts.filter((part) => id.includes(part.id));
    },
    updateParts: async (rows: typeof updated) => {
      updated.push(...rows);
    },
    listSeries: none,
    listCategories: none,
    listCategoryFields: none,
    listCategoryFieldOptions: none,
    listFitmentNotes: none,
  } as unknown as CatalogModuleService;
  return { catalog, updated, fullReads };
};

const openAi = () => {
  const requests: Record<string, string>[] = [];
  const prompts: string[] = [];
  globalThis.fetch = jest.fn(async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      messages: { content: string }[];
    };
    expect(body.model).toBe('gpt-6-luna');
    const fields = JSON.parse(body.messages[1].content) as Record<
      string,
      string
    >;
    requests.push(fields);
    prompts.push(body.messages[0].content);
    const answer = Object.fromEntries(
      Object.keys(fields).map((key) => [key, `translated ${key}`]),
    );
    return Response.json({
      choices: [{ message: { content: JSON.stringify(answer) } }],
    });
  }) as typeof fetch;
  return Object.assign(requests, { prompts });
};

const part = (index: number, description: string | null): Row => ({
  id: `part_${index}`,
  name: `Деталь ${index}`,
  description,
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('translateCatalogue', () => {
  it('reads the stale Parts of one source a page at a time', async () => {
    const requests = openAi();
    const parts = Array.from({ length: 20_001 }, (_, index) => ({
      ...part(index, null),
      name: 'Фильтр',
    }));
    const pages: number[] = [];
    const { catalog, updated } = catalogueOf(parts);
    Object.assign(catalog, {
      translationSources: async (table: string) =>
        table === 'part'
          ? [
              {
                name: 'Фильтр',
                description: null,
                translated_from: null,
                ids: parts.map(({ id }) => id),
              },
            ]
          : [],
      listParts: async ({ id }: { id: string[] }) => {
        pages.push(id.length);
        return parts.filter((row) => id.includes(row.id));
      },
    });

    await translateCatalogue(catalog, 'key');

    expect(pages).toEqual([20_000, 1]);
    expect(new Set(updated.map(({ id }) => id)).size).toBe(20_001);
    expect(requests.length).toBeGreaterThan(0);
  });

  it('stamps Parts with the same source with the same translated_from', async () => {
    openAi();
    const same = (id: string): Row => ({
      id,
      name: 'Фильтр',
      description: 'Масляный',
    });
    const { catalog, updated } = catalogueOf([
      same('part_a'),
      same('part_b'),
      part(3, 'Другой'),
    ]);

    await translateCatalogue(catalog, 'key');

    const stamps = new Map(
      updated.map(({ id, translated_from }) => [
        id,
        JSON.stringify(translated_from),
      ]),
    );
    expect(stamps.get('part_a')).toBe(stamps.get('part_b'));
    expect(stamps.get('part_3')).not.toBe(stamps.get('part_a'));
  });

  it('sends long Part descriptions in separate requests', async () => {
    const requests = openAi();
    const long = 'Аккумулятор для запуска двигателя. '.repeat(90);
    const { catalog, updated } = catalogueOf([
      part(1, long),
      part(2, long),
      part(3, long),
    ]);

    await translateCatalogue(catalog, 'key');

    expect(requests).toHaveLength(6);
    expect(requests.map((fields) => Object.keys(fields))).toContainEqual([
      'part_2.name',
      'part_2.description',
    ]);
    expect(updated[updated.length - 1]).toEqual({
      id: 'part_3',
      translations: {
        sr: {
          name: 'translated part_3.name',
          description: 'translated part_3.description',
        },
        en: {
          name: 'translated part_3.name',
          description: 'translated part_3.description',
        },
      },
      translated_from: expect.any(Object),
    });
  });

  it('keeps a hundred requests in flight at once', async () => {
    openAi();
    const answer = globalThis.fetch;
    let inFlight = 0;
    let most = 0;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      most = Math.max(most, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return answer(...args);
    }) as typeof fetch;
    const long = 'Аккумулятор для запуска двигателя. '.repeat(90);
    const parts = Array.from({ length: 150 }, (_, index) => part(index, long));
    const { catalog, updated } = catalogueOf(parts);

    await translateCatalogue(catalog, 'key');

    expect(most).toBe(100);
    expect(new Set(updated.map(({ id }) => id)).size).toBe(150);
  });

  it('asks again only for what a different prompt or model translated', async () => {
    const requests = openAi();
    const first = catalogueOf([part(1, null)]);
    await translateCatalogue(first.catalog, 'key');
    const { translated_from } = first.updated[
      first.updated.length - 1
    ] as unknown as {
      translated_from: Record<string, string>;
    };
    requests.length = 0;

    const current = catalogueOf([{ ...part(1, null), translated_from } as Row]);
    await translateCatalogue(current.catalog, 'key');
    expect(requests).toHaveLength(0);
    expect(current.fullReads).toEqual([]);

    const older = catalogueOf([
      {
        ...part(1, null),
        translated_from: {
          sr: sha256Hex(JSON.stringify({ name: 'Деталь 1' })),
          en: translated_from.en,
        },
      } as Row,
    ]);
    await translateCatalogue(older.catalog, 'key');
    expect([...requests]).toEqual([{ 'part_1.name': 'Деталь 1' }]);
  });

  it('describes CarLab as a parts catalogue for every common make', async () => {
    const { prompts } = openAi();
    await translateCatalogue(catalogueOf([part(1, null)]).catalog, 'key');

    expect(prompts[0]).toContain('all common car makes');
    expect(prompts[0]).not.toContain('BMW and Mercedes-Benz');
  });

  it('keeps short Parts together up to the row limit', async () => {
    const requests = openAi();
    const { catalog } = catalogueOf(
      Array.from({ length: 60 }, (_, index) => part(index, null)),
    );

    await translateCatalogue(catalog, 'key');

    expect(requests.map((fields) => Object.keys(fields).length)).toEqual([
      50, 10, 50, 10,
    ]);
  });
});
