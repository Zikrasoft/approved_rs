import { describe, expect, it } from 'vitest';
import ProcessSteps from './ProcessSteps.astro';
import { render } from './renderAstro';

const steps = [
  { title: 'Звонок', text: 'Договоримся о времени.' },
  { title: 'Осмотр', text: 'Находим причину.' },
];
const process = (slots = {}) =>
  render(ProcessSteps, { path: '/ru/', props: { steps }, slots });

describe('ProcessSteps', () => {
  it('numbers the steps in order with muted numerals, not orange ones', async () => {
    const items = [...(await process()).querySelectorAll('ol > li')];

    expect(
      items.map((item) => item.querySelector('span')?.textContent?.trim()),
    ).toEqual(['1', '2']);
    expect(items.map((item) => item.querySelector('h3')?.textContent)).toEqual([
      'Звонок',
      'Осмотр',
    ]);
    expect(items[0].querySelector('.text-signal-ink')).toBeNull();
  });

  it('explains each step unless the page asks for the titles alone', async () => {
    const texts = (root: Element) =>
      [...root.querySelectorAll('ol > li p')].map((p) => p.textContent);

    expect(texts(await process())).toEqual([
      'Договоримся о времени.',
      'Находим причину.',
    ]);
    expect(
      texts(
        await render(ProcessSteps, {
          path: '/ru/',
          props: { steps, titlesOnly: true },
        }),
      ),
    ).toEqual([]);
  });

  it('puts the first-step action under the first step only', async () => {
    const items = [
      ...(
        await process({ first: '<a id="act" href="#lead">x</a>' })
      ).querySelectorAll('ol > li'),
    ];

    expect(items[0].querySelector('#act')).not.toBeNull();
    expect(items[1].querySelector('#act')).toBeNull();
  });
});
