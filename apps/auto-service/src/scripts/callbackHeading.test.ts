// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { defineCallbackHeading } from './callbackHeading';

const form = {
  heading: 'Записаться в сервис',
  callbackTitle: 'Перезвоним вам',
};
const parts = 'Заявка на запчасти';

const press = (attributes: string) => {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<a href="#lead" data-trigger ${attributes}>open</a>`,
  );
  const trigger = document.querySelector<HTMLElement>('[data-trigger]')!;
  trigger.click();
  trigger.remove();
};

const title = (selector = 'carlab-modal[data-callback-heading]') => ({
  heading: document.querySelector(`${selector} h2`)?.textContent?.trim(),
  label: document
    .querySelector(`${selector} dialog`)
    ?.getAttribute('aria-label'),
});

beforeAll(() => {
  document.body.innerHTML = `
    <carlab-modal data-callback-heading="${form.callbackTitle}">
      <dialog aria-label="${form.heading}"><h2>${form.heading}</h2></dialog>
    </carlab-modal>
    <carlab-modal>
      <dialog aria-label="${parts}"><h2>${parts}</h2></dialog>
    </carlab-modal>`;
  defineCallbackHeading('carlab-modal');
  defineCallbackHeading('carlab-modal');
});

describe('the lead modal heading', () => {
  it('promises the callback when a callback control opens it', () => {
    press('data-open-lead-modal="phone"');
    expect(title()).toEqual({
      heading: form.callbackTitle,
      label: form.callbackTitle,
    });
  });

  it('goes back to the booking title for a booking trigger', () => {
    press('data-open-lead-modal');
    expect(title()).toEqual({ heading: form.heading, label: form.heading });
  });

  it('keeps the title for a click that opens no lead modal', () => {
    press('data-open-lead-modal="phone"');
    press('data-other');
    expect(title().heading).toBe(form.callbackTitle);
    document.body.insertAdjacentText('beforeend', 'text');
    document.body.lastChild!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(title().heading).toBe(form.callbackTitle);
  });

  it('leaves a modal without a callback heading alone', () => {
    press('data-open-lead-modal="phone"');
    expect(
      document.querySelector('carlab-modal:not([data-callback-heading]) h2')
        ?.textContent,
    ).toBe(parts);
  });

  it('skips a callback host with no dialog', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<carlab-modal data-callback-heading="x"><h2>y</h2></carlab-modal>',
    );
    press('data-open-lead-modal="phone"');
    expect(document.body.lastElementChild?.textContent).toBe('y');
  });
});
