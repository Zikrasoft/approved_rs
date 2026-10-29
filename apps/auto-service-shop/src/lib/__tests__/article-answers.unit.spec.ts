import { createFakeShopAi } from '../../../integration-tests/fakeShopAi';
import { memoryBucket } from '../../../integration-tests/fakeStorage';
import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../admin-errors';
import { cachedArticleAnswer } from '../ai/cache';

const article = {
  name: 'Filter ulja',
  brand: 'MANN-FILTER',
  number: 'HU 816 x',
  description: null,
  specs: {},
  fits: [],
  category_id: null,
};
const categories = [{ id: 'cat_oil', name: 'Масляные фильтры' }];

describe('cached article answers', () => {
  it('answers a repeated article from the cache without asking again', async () => {
    const fake = createFakeShopAi();
    fake.name = 'Масляный фильтр MANN-FILTER HU 816 x';
    const { bucket } = memoryBucket();

    const first = await cachedArticleAnswer(
      fake.ai,
      bucket,
      article,
      categories,
    );
    fake.name = 'Другое имя';
    const second = await cachedArticleAnswer(
      fake.ai,
      bucket,
      article,
      categories,
    );

    expect(second).toEqual(first);
    expect(second.name).toBe('Масляный фильтр MANN-FILTER HU 816 x');
    expect(fake.articlesAsked).toHaveLength(1);
  });

  it('asks again for another input, another prompt or another model', async () => {
    const fake = createFakeShopAi();
    const { bucket } = memoryBucket();

    await cachedArticleAnswer(fake.ai, bucket, article, categories);
    await cachedArticleAnswer(
      fake.ai,
      bucket,
      { ...article, number: 'W 712' },
      categories,
    );
    await cachedArticleAnswer(fake.ai, bucket, article, []);
    fake.model = 'gpt-4o';
    await cachedArticleAnswer(fake.ai, bucket, article, categories);

    expect(fake.articlesAsked).toHaveLength(4);
  });

  it('asks again over a stored answer it cannot read', async () => {
    const fake = createFakeShopAi();
    const { bucket, objects } = memoryBucket();
    await cachedArticleAnswer(fake.ai, bucket, article, categories);
    for (const stored of objects.values()) {
      stored.body = Buffer.from('{"name":"Оpruga"}');
    }

    const answer = await cachedArticleAnswer(
      fake.ai,
      bucket,
      article,
      categories,
    );

    expect(answer.name).toBe('Filter ulja');
    expect(fake.articlesAsked).toHaveLength(2);
  });

  it('keeps an answer that failed validation, so a rerun asks nothing and fails the same way', async () => {
    const fake = createFakeShopAi();
    fake.failure = adminError(
      MedusaError.Types.INVALID_DATA,
      'ARTICLE_UNREADABLE',
      'The article could not be read: a word mixes Latin and Cyrillic letters: Оpruga',
      { invalid: true },
    );
    const { bucket } = memoryBucket();
    const ask = () => cachedArticleAnswer(fake.ai, bucket, article, categories);

    await expect(ask()).rejects.toMatchObject({ code: 'ARTICLE_UNREADABLE' });
    await expect(ask()).rejects.toThrow(/Оpruga/u);

    expect(fake.questions).toBe(1);
  });

  it('asks again after an answer that was empty rather than invalid', async () => {
    const fake = createFakeShopAi();
    fake.failure = adminError(
      MedusaError.Types.INVALID_DATA,
      'ARTICLE_UNREADABLE',
      'The article could not be read: the answer is empty',
      { invalid: false },
    );
    const { bucket } = memoryBucket();
    const ask = () => cachedArticleAnswer(fake.ai, bucket, article, categories);

    await expect(ask()).rejects.toMatchObject({ code: 'ARTICLE_UNREADABLE' });
    await expect(ask()).rejects.toMatchObject({ code: 'ARTICLE_UNREADABLE' });

    expect(fake.questions).toBe(2);
  });

  it('asks again after a failure that is not about the answer', async () => {
    const fake = createFakeShopAi();
    fake.failure = new Error('OpenAI is down');
    const { bucket } = memoryBucket();
    const ask = () => cachedArticleAnswer(fake.ai, bucket, article, categories);

    await expect(ask()).rejects.toThrow('OpenAI is down');
    fake.failure = null;
    await expect(ask()).resolves.toMatchObject({ name: 'Filter ulja' });

    expect(fake.questions).toBe(2);
  });

  it('asks every time without storage', async () => {
    const fake = createFakeShopAi();

    await cachedArticleAnswer(fake.ai, null, article, categories);
    await cachedArticleAnswer(fake.ai, null, article, categories);

    expect(fake.articlesAsked).toHaveLength(2);
  });
});
