import { openAiShopAi } from '../ai/openai';

const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
const CATEGORIES = [{ id: 'cat_oil', name: 'Масляные фильтры' }];

const replying = (content: string) =>
  jest.fn(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );

const answering = (answer: unknown) => replying(JSON.stringify(answer));

const line = {
  name: 'Filter ulja',
  number: 'HU 816 x',
  quantity: 1,
  brand: 'MANN-FILTER',
  brand_confidence: 0.9,
  category_id: 'cat_oil',
};

describe('OpenAI shop AI', () => {
  const networkFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = networkFetch;
  });

  it('reads the quote and drops the prices the model returns', async () => {
    globalThis.fetch = answering({
      vin: 'WBA35BG070N074158',
      vehicle: 'BMW 320d',
      total: 12000,
      lines: [{ ...line, price: 1500, unit_price: 1500 }],
    });

    const reading = await openAiShopAi('test-key').readQuote(PDF, CATEGORIES);

    expect(reading).toEqual({
      vin: 'WBA35BG070N074158',
      vehicle: 'BMW 320d',
      lines: [line],
    });
  });

  it.each([
    ['a confidence above one', { ...line, brand_confidence: 1.5 }],
    ['a fractional quantity', { ...line, quantity: 0.5 }],
    ['a missing number', { ...line, number: undefined }],
  ])('refuses an answer with %s', async (_, badLine) => {
    globalThis.fetch = answering({
      vin: null,
      vehicle: null,
      lines: [badLine],
    });

    await expect(
      openAiShopAi('test-key').readQuote(PDF, CATEGORIES),
    ).rejects.toMatchObject({ code: 'QUOTE_UNREADABLE' });
  });

  it('refuses an answer that is not JSON', async () => {
    globalThis.fetch = replying('ponuda');

    await expect(
      openAiShopAi('test-key').readQuote(PDF, CATEGORIES),
    ).rejects.toMatchObject({ code: 'QUOTE_UNREADABLE' });
  });

  const article = {
    name: 'Масло 0W-20',
    brand: 'MANN-FILTER',
    number: 'OIL 0W20',
    description: 'Potpuno sintetičko ulje.',
    specs: { Viskozitet: '0W-20' },
  };

  it('picks a Category only from the list it was given', async () => {
    globalThis.fetch = answering({ category_id: 'cat_oil' });
    const picked = await openAiShopAi('test-key').pickCategory(
      article,
      CATEGORIES,
    );
    globalThis.fetch = answering({ category_id: 'cat_invented' });
    const invented = await openAiShopAi('test-key').pickCategory(
      article,
      CATEGORIES,
    );

    expect([picked, invented]).toEqual(['cat_oil', null]);
  });

  it('maps specs to attribute values and refuses anything else', async () => {
    const fields = [
      {
        key: 'viscosity',
        label: 'Вязкость',
        type: 'text' as const,
        unit: null,
        required: true,
        options: [],
      },
    ];
    globalThis.fetch = answering({ attributes: { viscosity: '0W-20' } });
    const mapped = await openAiShopAi('test-key').mapSpecs(
      article.specs,
      fields,
    );
    globalThis.fetch = answering({ attributes: { viscosity: { w: 0 } } });

    expect(mapped).toEqual({ viscosity: '0W-20' });
    await expect(
      openAiShopAi('test-key').mapSpecs(article.specs, fields),
    ).rejects.toMatchObject({ code: 'ARTICLE_UNREADABLE' });
  });

  it('writes a description and refuses a blank one', async () => {
    globalThis.fetch = answering({ description: ' Синтетическое масло. ' });
    const written = await openAiShopAi('test-key').writeDescription(article);
    globalThis.fetch = answering({ description: ' ' });

    expect(written).toBe('Синтетическое масло.');
    await expect(
      openAiShopAi('test-key').writeDescription(article),
    ).rejects.toMatchObject({ code: 'ARTICLE_UNREADABLE' });
  });

  it('writes the description without the yo letter or an em dash even when the model uses them', async () => {
    globalThis.fetch = answering({
      description: 'Её задача — защитить двигатель. Ёмкость 2 Ач.',
    });

    const written = await openAiShopAi('test-key').writeDescription(article);

    expect(written).toBe('Ее задача - защитить двигатель. Емкость 2 Ач.');
  });

  it('says the key is missing without calling OpenAI', async () => {
    globalThis.fetch = answering({ vin: null, vehicle: null, lines: [] });

    await expect(
      openAiShopAi(undefined).readQuote(PDF, CATEGORIES),
    ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
