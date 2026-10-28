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

const answeringInTurn = (...answers: unknown[]) => {
  const queue = [...answers];
  return jest.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(queue.shift()) } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  );
};

const sentMessages = (fetch: unknown, call = 0) => {
  const [, init] = (fetch as jest.Mock).mock.calls[call] as [
    unknown,
    { body: string },
  ];
  const { messages } = JSON.parse(init.body) as {
    messages: { role: string; content: string }[];
  };
  return {
    system: messages.find(({ role }) => role === 'system')?.content ?? '',
    user: messages.find(({ role }) => role === 'user')?.content ?? '',
  };
};

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

  const placed = { name: 'Моторное масло 0W-20', category: 'Моторное масло' };

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
    const written = await openAiShopAi('test-key').writeDescription(
      article,
      placed,
    );
    globalThis.fetch = answering({ description: ' ' });

    expect(written).toBe('Синтетическое масло.');
    await expect(
      openAiShopAi('test-key').writeDescription(article, placed),
    ).rejects.toMatchObject({ code: 'ARTICLE_UNREADABLE' });
  });

  it('writes the description without the yo letter or an em dash even when the model uses them', async () => {
    globalThis.fetch = answering({
      description: 'Её задача — защитить двигатель. Ёмкость 2 Ач.',
    });

    const written = await openAiShopAi('test-key').writeDescription(
      article,
      placed,
    );

    expect(written).toBe('Ее задача - защитить двигатель. Емкость 2 Ач.');
  });

  it('describes the part under the Russian name and the Category it was given', async () => {
    globalThis.fetch = answering({ description: 'Масляный фильтр.' });

    await openAiShopAi('test-key').writeDescription(
      { ...article, name: 'uljni filter sa zaptivnim prstenom' },
      {
        name: 'Масляный фильтр Blue Print ADA102116',
        category: 'Масляные фильтры',
      },
    );

    const { system, user } = sentMessages(globalThis.fetch);
    expect(JSON.parse(user)).toMatchObject({
      name: 'uljni filter sa zaptivnim prstenom',
      russian_name: 'Масляный фильтр Blue Print ADA102116',
      category: 'Масляные фильтры',
    });
    expect(system).toContain('russian_name');
    expect(system).toContain('category');
  });

  it.each([
    ['a Latin letter inside a Cyrillic word', 'Оpruga амортизатора.'],
    ['a Cyrillic letter inside a Latin word', 'Емкость 70 Аh, ток 720 ВA.'],
  ])(
    'asks again once for a description with %s, then refuses it',
    async (_, mixed) => {
      globalThis.fetch = answeringInTurn(
        { description: mixed },
        { description: 'Пружина подвески.' },
      );
      const retried = await openAiShopAi('test-key').writeDescription(
        article,
        placed,
      );
      expect(retried).toBe('Пружина подвески.');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      globalThis.fetch = answering({ description: mixed });
      await expect(
        openAiShopAi('test-key').writeDescription(article, placed),
      ).rejects.toMatchObject({ code: 'ARTICLE_UNREADABLE' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it('asks again once for a name with a word of mixed letters, then refuses it', async () => {
    globalThis.fetch = answeringInTurn(
      { name: 'Оpruga Bilstein B4' },
      { name: 'Пружина подвески Bilstein B4' },
    );
    const retried = await openAiShopAi('test-key').writeName(article);
    globalThis.fetch = answering({ name: 'Оpruga Bilstein B4' });

    expect(retried).toBe('Пружина подвески Bilstein B4');
    await expect(
      openAiShopAi('test-key').writeName(article),
    ).rejects.toMatchObject({ code: 'ARTICLE_UNREADABLE' });
  });

  it('keeps brand names and numbers in Latin beside Russian words', async () => {
    globalThis.fetch = answering({
      name: 'Масляный фильтр MANN-FILTER HU 816 x',
    });

    await expect(openAiShopAi('test-key').writeName(article)).resolves.toBe(
      'Масляный фильтр MANN-FILTER HU 816 x',
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('offers each Category with its description and files control arms under suspension', async () => {
    globalThis.fetch = answering({ category_id: 'cat_arm' });

    await openAiShopAi('test-key').pickCategory(article, [
      {
        id: 'cat_arm',
        name: 'Подвеска',
        text: 'Рычаги, шаровые опоры, сайлентблоки',
      },
      { id: 'cat_body', name: 'Кузов', text: '' },
    ]);

    const { system } = sentMessages(globalThis.fetch);
    expect(system).toMatch(
      /^cat_arm: Подвеска \(Рычаги, шаровые опоры, сайлентблоки\)$/mu,
    );
    expect(system).toMatch(/^cat_body: Кузов$/mu);
    expect(system).toMatch(/rame/u);
  });

  it('writes a Russian name in house style and refuses a blank one', async () => {
    globalThis.fetch = answering({ name: ' Моторное масло Castrol — 5W-30 ' });
    const written = await openAiShopAi('test-key').writeName(article);
    globalThis.fetch = answering({ name: ' ' });

    expect(written).toBe('Моторное масло Castrol - 5W-30');
    await expect(
      openAiShopAi('test-key').writeName(article),
    ).rejects.toMatchObject({ code: 'ARTICLE_UNREADABLE' });
  });

  it('says the key is missing without calling OpenAI', async () => {
    globalThis.fetch = answering({ vin: null, vehicle: null, lines: [] });

    await expect(
      openAiShopAi(undefined).readQuote(PDF, CATEGORIES),
    ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
