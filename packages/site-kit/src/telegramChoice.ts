import { TELEGRAM_CHOICE_ATTRIBUTE } from './contactControl.ts';
import { GOALS, reachGoal } from './goals.ts';
import {
  defineModalDialog,
  MODAL_OPEN_EVENT,
  type ModalOpenDetail,
} from './modalDialog.ts';

const OPTIONS = ['bot', 'manager'] as const;

export function defineTelegramChoice(tagName = 'telegram-choice'): void {
  if (customElements.get(tagName)) return;
  defineModalDialog(tagName);
  const hook = (option: string) => `[data-telegram-choice-${option}]`;
  document.addEventListener(MODAL_OPEN_EVENT, (event) => {
    const host = event.target as HTMLElement;
    if (!host.matches(tagName)) return;
    const { trigger } = (event as CustomEvent<ModalOpenDetail>).detail;
    const link = (option: string) =>
      host.querySelector<HTMLAnchorElement>(hook(option))!;
    link('bot').href = (trigger as HTMLAnchorElement).href;
    link('manager').href = trigger.getAttribute(TELEGRAM_CHOICE_ATTRIBUTE)!;
  });
  document.addEventListener('click', (event) => {
    const target = event.target as Element;
    const option = OPTIONS.find((name) =>
      target.closest?.(`${tagName} ${hook(name)}`),
    );
    if (option) reachGoal(GOALS.telegramChoice, { option });
  });
}
