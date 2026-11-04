import { z } from 'zod';

import claimWords from './claim-words.json';

const CLAIM_STEMS = z.array(z.string().min(1)).parse(claimWords);

const claims = (sentence: string) => {
  const lower = sentence.toLowerCase();
  return CLAIM_STEMS.some((stem) => lower.includes(stem));
};

const sentencesOf = (paragraph: string) =>
  paragraph.trim().split(/(?<=[.!?])\s+/u);

export const capitalized = (text: string) =>
  text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);

// TODO: a stem list over-cuts a sentence that only mentions a listed word in passing; tune claim-words.json from real descriptions.
export const plainDescription = (text: string, name: string): string => {
  const paragraphs = text
    .split(/\n\s*\n/u)
    .map((paragraph) => sentencesOf(paragraph));
  const opensWithClaim = claims(paragraphs[0]?.[0] ?? '');
  const kept = paragraphs
    .map((sentences) =>
      sentences.filter((sentence) => !claims(sentence)).join(' '),
    )
    .filter(Boolean)
    .join('\n\n');
  if (!kept) return '';
  const opened = opensWithClaim ? `${name}. ${kept}` : kept;
  return capitalized(opened);
};
