import { z } from 'zod';

import claimWords from './claim-words.json';

const CLAIM_STEMS = z.array(z.string().min(1)).parse(claimWords);

const claims = (sentence: string) => {
  const lower = sentence.toLowerCase();
  return CLAIM_STEMS.some((stem) => lower.includes(stem));
};

const sentencesOf = (paragraph: string) =>
  paragraph.trim().split(/(?<=[.!?])\s+/u);

// TODO: a stem list over-cuts a sentence that only mentions a listed word in passing; tune claim-words.json from real descriptions.
export const plainDescription = (text: string): string => {
  const [first, ...rest] = text
    .split(/\n\s*\n/u)
    .map((paragraph, at) =>
      sentencesOf(paragraph)
        .filter(
          (sentence, index) => (at === 0 && index === 0) || !claims(sentence),
        )
        .join(' '),
    )
    .filter(Boolean);
  const kept = [first ?? '', ...rest].join('\n\n');
  return kept.charAt(0).toLocaleUpperCase('ru') + kept.slice(1);
};
