import type CatalogModuleService from '../../../modules/catalog/service';
import { sha256Hex } from '@podbor/i18n/translate/core';

import { translateCatalogue } from '../translate';

type Row = { id: string; name: string; description: string | null };

const catalogueOf = (parts: Row[]) => {
  const updated: { id: string; translations: unknown }[] = [];
  const none = async () => [];
  const catalog = {
    listParts: async () => parts,
    updateParts: async (rows: { id: string; translations: unknown }[]) => {
      updated.push(...rows);
    },
    listSeries: none,
    listCategories: none,
    listCategoryFields: none,
    listCategoryFieldOptions: none,
    listFitments: none,
  } as unknown as CatalogModuleService;
  return { catalog, updated };
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
  it('reads the Parts a page at a time', async () => {
    openAi();
    const parts = Array.from({ length: 2_001 }, (_, index) =>
      part(index, null),
    ).sort((a, b) => a.id.localeCompare(b.id));
    const pages: number[] = [];
    const { catalog, updated } = catalogueOf([]);
    Object.assign(catalog, {
      listParts: async (
        filters: { id?: { $gt: string } },
        { take }: { take: number },
      ) => {
        const page = parts
          .filter(({ id }) => !filters.id || id > filters.id.$gt)
          .slice(0, take);
        pages.push(page.length);
        return page;
      },
    });

    await translateCatalogue(catalog, 'key');

    expect(pages).toEqual([2_000, 1]);
    expect(new Set(updated.map(({ id }) => id)).size).toBe(2_001);
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
