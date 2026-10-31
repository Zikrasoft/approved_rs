import type CatalogModuleService from '../../../modules/catalog/service';
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
  globalThis.fetch = jest.fn(async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      messages: { content: string }[];
    };
    expect(body.model).toBe('gpt-6.1-terra');
    const fields = JSON.parse(body.messages[1].content) as Record<
      string,
      string
    >;
    requests.push(fields);
    const answer = Object.fromEntries(
      Object.keys(fields).map((key) => [key, `translated ${key}`]),
    );
    return Response.json({
      choices: [{ message: { content: JSON.stringify(answer) } }],
    });
  }) as typeof fetch;
  return requests;
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
