import { createHash } from 'node:crypto';

import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';

import { adminError } from '../admin-errors';
import type { Bucket } from '../storage';
import {
  type ArticleAnswer,
  articleAnswerSchema,
  type ArticleInput,
  type CategoryChoice,
  type ShopAi,
} from './contract';

const UNREADABLE = 'ARTICLE_UNREADABLE';

const storedSchema = z.union([
  articleAnswerSchema,
  z.object({ unreadable: z.string() }),
]);

const unreadableAnswer = (message: string) =>
  adminError(MedusaError.Types.INVALID_DATA, UNREADABLE, message);

const storedAnswer = async (bucket: Bucket, key: string) => {
  const stored = await bucket.get(key);
  if (!stored) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(stored.toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const store = (bucket: Bucket, key: string, value: unknown) =>
  bucket.put(key, Buffer.from(JSON.stringify(value)), {
    contentType: 'application/json',
  });

export async function cachedArticleAnswer(
  ai: ShopAi,
  bucket: Bucket | null,
  article: ArticleInput,
  categories: CategoryChoice[],
): Promise<ArticleAnswer> {
  const question = ai.articleQuestion(article, categories);
  if (!bucket) return ai.answerArticle(question);
  const key = `ai-answers/${createHash('sha256')
    .update(JSON.stringify([question.model, question.system, question.user]))
    .digest('hex')}.json`;
  const stored = await storedAnswer(bucket, key);
  if (stored && 'unreadable' in stored) {
    throw unreadableAnswer(stored.unreadable);
  }
  if (stored) return stored;
  try {
    const answer = await ai.answerArticle(question);
    await store(bucket, key, answer);
    return answer;
  } catch (error) {
    if (MedusaError.isMedusaError(error) && error.code === UNREADABLE) {
      await store(bucket, key, { unreadable: error.message });
    }
    throw error;
  }
}
