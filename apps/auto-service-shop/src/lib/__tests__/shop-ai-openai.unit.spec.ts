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

    const reading = await openAiShopAi('test-key', 'gpt-4o-mini').readQuote(
      PDF,
      CATEGORIES,
    );

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
      openAiShopAi('test-key', 'gpt-4o-mini').readQuote(PDF, CATEGORIES),
    ).rejects.toMatchObject({ code: 'QUOTE_UNREADABLE' });
  });

  it('refuses an answer that is not JSON', async () => {
    globalThis.fetch = replying('ponuda');

    await expect(
      openAiShopAi('test-key', 'gpt-4o-mini').readQuote(PDF, CATEGORIES),
    ).rejects.toMatchObject({ code: 'QUOTE_UNREADABLE' });
  });

  const article = {
    name: 'Масло 0W-20',
    brand: 'MANN-FILTER',
    number: 'OIL 0W20',
    description: 'Potpuno sintetičko ulje.',
    specs: { Viskozitet: '0W-20' },
    fits: ['BMW 3 (G20)'],
    category_id: null,
  };

  const answer = {
    name: 'Моторное масло MANN-FILTER OIL 0W20',
    category_id: 'cat_oil',
    attributes: { viscosity: '0W-20' },
    description: 'Синтетическое масло.',
  };

  const shopAi = () => openAiShopAi('test-key', 'gpt-4o-mini');

  const answerOf = (ai = shopAi(), categories = CATEGORIES) =>
    ai.answerArticle(ai.articleQuestion(article, categories));

  const sentBody = (fetch: unknown, call = 0) =>
    JSON.parse(
      ((fetch as jest.Mock).mock.calls[call] as [unknown, { body: string }])[1]
        .body,
    ) as { model: string; temperature: number };

  it('answers an article in one call on the configured model, with the most likely answer', async () => {
    globalThis.fetch = answering(answer);

    await expect(answerOf()).resolves.toEqual(answer);
    await answerOf(openAiShopAi('test-key', 'gpt-4.1-mini'));

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(sentBody(globalThis.fetch)).toMatchObject({
      model: 'gpt-4o-mini',
      temperature: 0,
    });
    expect(sentBody(globalThis.fetch, 1).model).toBe('gpt-4.1-mini');
    expect(shopAi().articleQuestion(article, CATEGORIES).model).toBe(
      'gpt-4o-mini',
    );
  });

  it('sends the article as JSON with the Category it is already filed under', async () => {
    globalThis.fetch = answering(answer);
    const ai = shopAi();

    await ai.answerArticle(
      ai.articleQuestion({ ...article, category_id: 'cat_oil' }, CATEGORIES),
    );

    expect(JSON.parse(sentMessages(globalThis.fetch).user)).toEqual({
      ...article,
      category_id: 'cat_oil',
    });
    expect(sentMessages(globalThis.fetch).system).toContain('category_id');
  });

  it('keeps an answer and drops only its attribute values that are not values', async () => {
    globalThis.fetch = answering({
      ...answer,
      attributes: { viscosity: '0W-20', capacity: null, volume: { l: 5 } },
    });

    await expect(answerOf()).resolves.toMatchObject({
      attributes: { viscosity: '0W-20' },
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a blank name', { name: ' ' }],
    ['a blank description', { description: ' ' }],
    ['no Category field', { category_id: undefined }],
  ])('refuses an answer with %s', async (_, bad) => {
    globalThis.fetch = answering({ ...answer, ...bad });

    await expect(answerOf()).rejects.toMatchObject({
      code: 'ARTICLE_UNREADABLE',
    });
  });

  it('takes an answer without a description', async () => {
    globalThis.fetch = answering({ ...answer, description: null });

    await expect(answerOf()).resolves.toMatchObject({ description: null });
  });

  it('writes the name and description without the yo letter or an em dash even when the model uses them', async () => {
    globalThis.fetch = answering({
      ...answer,
      name: ' Моторное масло Castrol — 5W-30 ',
      description: 'Её задача — защитить двигатель. Ёмкость 2 Ач.',
    });

    await expect(answerOf()).resolves.toMatchObject({
      name: 'Моторное масло Castrol - 5W-30',
      description: 'Ее задача - защитить двигатель. Емкость 2 Ач.',
    });
  });

  it.each([
    [
      'a Latin letter inside a Cyrillic word',
      { description: 'Оpruga амортизатора.' },
    ],
    [
      'a Cyrillic letter inside a Latin word',
      { description: 'Емкость 70 Аh.' },
    ],
    ['a name of mixed letters', { name: 'Оpruga Bilstein B4' }],
  ])(
    'asks again once for an answer with %s, then refuses it',
    async (_, mixed) => {
      globalThis.fetch = answeringInTurn({ ...answer, ...mixed }, answer);
      await expect(answerOf()).resolves.toEqual(answer);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      globalThis.fetch = answering({ ...answer, ...mixed });
      await expect(answerOf()).rejects.toMatchObject({
        code: 'ARTICLE_UNREADABLE',
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it('reads a Latin look-alike letter inside a Russian word as its Cyrillic twin without asking again', async () => {
    globalThis.fetch = answering({
      ...answer,
      name: 'Тормозной cуппорт febi 179174',
      description: 'Тормозной cуппорт для задней оси.',
    });

    await expect(answerOf()).resolves.toMatchObject({
      name: 'Тормозной суппорт febi 179174',
      description: 'Тормозной суппорт для задней оси.',
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('names the word that mixes letters when it refuses an answer', async () => {
    globalThis.fetch = answering({ ...answer, name: 'Оpruga Bilstein B4' });

    await expect(answerOf()).rejects.toThrow(/Оpruga/u);
  });

  it('keeps brand names and numbers in Latin beside Russian words', async () => {
    globalThis.fetch = answering({
      ...answer,
      name: 'Масляный фильтр MANN-FILTER HU 816 x',
    });

    await expect(answerOf()).resolves.toMatchObject({
      name: 'Масляный фильтр MANN-FILTER HU 816 x',
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('offers each Category with its description and fields and files control arms and bump stops under suspension', () => {
    const { system } = shopAi().articleQuestion(article, [
      {
        id: 'cat_arm',
        name: 'Подвеска',
        text: 'Рычаги, шаровые опоры, сайлентблоки',
      },
      {
        id: 'cat_battery',
        name: 'Аккумуляторы',
        text: '',
        fields: [
          {
            key: 'technology',
            label: 'Технология',
            type: 'single-select',
            unit: null,
            required: false,
            options: [{ key: 'standard', label: 'Стандартная' }],
          },
        ],
      },
    ]);

    expect(system).toMatch(
      /^cat_arm: Подвеска \(Рычаги, шаровые опоры, сайлентблоки\)$/mu,
    );
    expect(system).toMatch(/^cat_battery: Аккумуляторы$/mu);
    expect(system).toMatch(/^ {2}fields: \[\{"key":"technology"/mu);
    expect(system).toMatch(/rame/u);
    expect(system).toMatch(/odbojna guma/u);
    expect(system).toMatch(/SLI/u);
  });

  it('steers Serbian part names through the parts glossary', () => {
    const { system } = shopAi().articleQuestion(article, CATEGORIES);

    expect(system).toMatch(/nosač stabilizatora.*втулка стабилизатора/u);
    expect(system).toMatch(/španer.*натяжитель ремня/u);
    expect(system).toMatch(/svećica.*свеча зажигания/u);
  });

  it('files every filter and battery and leaves a Category empty only when none covers the part', () => {
    const { system } = shopAi().articleQuestion(article, CATEGORIES);

    expect(system).toMatch(/oil, air, cabin, fuel/u);
    expect(system).toMatch(/batter/u);
    expect(system).not.toMatch(/Prefer null/u);
  });

  it('asks for a description of its own for each part, without the supplier claims', () => {
    const { system } = shopAi().articleQuestion(article, CATEGORIES);

    expect(system).toMatch(/Strogi standardi kvaliteta/u);
  });

  it('asks nothing without a key', async () => {
    globalThis.fetch = answering(answer);

    await expect(
      answerOf(openAiShopAi(undefined, 'gpt-4o-mini')),
    ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('says the key is missing without calling OpenAI', async () => {
    globalThis.fetch = answering({ vin: null, vehicle: null, lines: [] });

    await expect(
      openAiShopAi(undefined, 'gpt-4o-mini').readQuote(PDF, CATEGORIES),
    ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
