import { describe, it, expect } from 'vitest';
import { renderAiCatalog } from './aiCatalog.ts';

describe('renderAiCatalog', () => {
  it('lists the llms.txt of every locale, described in its own language', () => {
    expect(
      renderAiCatalog({
        site: { name: 'Details', url: 'https://details.rs' },
        locales: ['sr', 'ru'],
        summary: (locale) => (locale === 'sr' ? 'Studio' : 'Студия'),
      }),
    ).toEqual({
      specVersion: '1.0',
      host: { displayName: 'Details', identifier: 'details.rs' },
      entries: [
        {
          identifier: 'urn:air:details.rs:knowledge:llms-txt-sr',
          displayName: 'Details llms.txt (sr)',
          type: 'text/plain',
          url: 'https://details.rs/sr/llms.txt',
          description: 'Studio',
        },
        {
          identifier: 'urn:air:details.rs:knowledge:llms-txt-ru',
          displayName: 'Details llms.txt (ru)',
          type: 'text/plain',
          url: 'https://details.rs/ru/llms.txt',
          description: 'Студия',
        },
      ],
    });
  });
});
