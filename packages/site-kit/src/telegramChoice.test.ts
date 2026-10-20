// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { defineTelegramChoice } from './telegramChoice.ts';
import { MODAL_OPEN_EVENT } from './modalDialog.ts';
import { TELEGRAM_CHOICE_SELECTOR } from './contactControl.ts';

// TODO: drop once jsdom implements HTMLDialogElement.showModal/close.
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

const BOT = 'https://t.me/brand_capture_bot';
const MANAGER = 'https://t.me/brand_manager';

let counter = 0;

function mount() {
  const tagName = `telegram-choice-${(counter += 1)}`;
  defineTelegramChoice(tagName);
  document.body.innerHTML = `
    <a href="${BOT}?start=ppf_ru" data-telegram-choice="${MANAGER}" data-tile="ppf">Telegram</a>
    <a href="${BOT}?start=ru" data-telegram-choice="${MANAGER}" data-tile="home">Telegram</a>
    <a href="${BOT}?start=en" data-tile="bare">Telegram</a>
    <${tagName} trigger='${TELEGRAM_CHOICE_SELECTOR}'>
      <dialog>
        <a data-telegram-choice-bot data-modal-close>Bot</a>
        <a data-telegram-choice-manager data-modal-close>Manager</a>
      </dialog>
    </${tagName}>
  `;
  const link = (selector: string) =>
    document.querySelector<HTMLAnchorElement>(selector)!;
  return {
    dialog: document.querySelector('dialog')!,
    tile: (name: string) => link(`[data-tile="${name}"]`),
    bot: link('[data-telegram-choice-bot]'),
    manager: link('[data-telegram-choice-manager]'),
  };
}

const click = (element: HTMLElement) => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('defineTelegramChoice', () => {
  it('asks bot or manager instead of following a tile that offers both', () => {
    const { dialog, tile, bot, manager } = mount();

    const event = click(tile('ppf'));

    expect(event.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    expect(bot.href).toBe(`${BOT}?start=ppf_ru`);
    expect(manager.href).toBe(MANAGER);
  });

  it('carries the payload of whichever tile was tapped', () => {
    const { dialog, tile, bot } = mount();

    click(tile('ppf'));
    click(bot);
    click(tile('home'));

    expect(dialog.open).toBe(true);
    expect(bot.href).toBe(`${BOT}?start=ru`);
  });

  it('leaves a tile without a manager alone', () => {
    const { dialog, tile } = mount();

    const event = click(tile('bare'));

    expect(event.defaultPrevented).toBe(false);
    expect(dialog.open).toBe(false);
  });

  it('closes once a choice is made', () => {
    const { dialog, tile, manager } = mount();

    click(tile('ppf'));
    click(manager);

    expect(dialog.open).toBe(false);
  });

  it.each(['bot', 'manager'] as const)(
    'counts a %s pick as its own goal',
    (option) => {
      const trackGoal = vi.fn();
      vi.stubGlobal('trackGoal', trackGoal);
      const picks = mount();

      click(picks.tile('ppf'));
      click(picks[option]);

      expect(trackGoal).toHaveBeenCalledExactlyOnceWith('telegram_choice', {
        option,
      });
      vi.unstubAllGlobals();
    },
  );

  it('ignores other modals opening', () => {
    const { bot } = mount();
    const other = document.createElement('div');
    document.body.append(other);

    other.dispatchEvent(
      new CustomEvent(MODAL_OPEN_EVENT, {
        bubbles: true,
        detail: { trigger: other },
      }),
    );

    expect(bot.hasAttribute('href')).toBe(false);
  });

  it('defines each tag once', () => {
    const define = vi.spyOn(customElements, 'define');
    defineTelegramChoice('telegram-choice-once');
    defineTelegramChoice('telegram-choice-once');
    expect(define).toHaveBeenCalledTimes(1);
    define.mockRestore();
  });
});
