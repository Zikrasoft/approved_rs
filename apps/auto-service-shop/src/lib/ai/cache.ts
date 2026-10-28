import { createHash } from 'node:crypto';

import type { Bucket } from '../storage';
import {
  type ArticleAnswer,
  articleAnswerSchema,
  type ArticleInput,
  type CategoryChoice,
  type ShopAi,
} from './contract';

const storedAnswer = async (bucket: Bucket, key: string) => {
  const stored = await bucket.get(key);
  if (!stored) return null;
  try {
    const parsed = articleAnswerSchema.safeParse(
      JSON.parse(stored.toString('utf8')),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

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
  if (stored) return stored;
  const answer = await ai.answerArticle(question);
  await bucket.put(key, Buffer.from(JSON.stringify(answer)), {
    contentType: 'application/json',
  });
  return answer;
}
