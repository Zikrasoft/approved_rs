import { SERVICE_FIELD } from '@podbor/lead-crm/fields';
import { GOALS, reachGoal } from './goals.ts';
import {
  defineModalDialog,
  MODAL_FOCUS_ATTRIBUTE,
  MODAL_OPEN_EVENT,
  type ModalOpenDetail,
} from './modalDialog.ts';

export const OPEN_LEAD_MODAL_ATTRIBUTE = 'data-open-lead-modal';
export const LEAD_SERVICE_ATTRIBUTE = 'data-lead-service';
export const DEFAULT_SERVICE_ATTRIBUTE = 'data-default-service';
export const PAGE_LEAD_MODAL_ATTRIBUTE = 'data-page-lead-modal';

const armed = new Set<string>();

function standDownForPageModal(tagName: string): void {
  if (!document.querySelector(`${tagName}[${PAGE_LEAD_MODAL_ATTRIBUTE}]`))
    return;
  for (const modal of document.querySelectorAll(
    `${tagName}:not([${PAGE_LEAD_MODAL_ATTRIBUTE}])`,
  ))
    modal.removeAttribute('trigger');
}

function prepare(host: HTMLElement, trigger: HTMLElement): void {
  const form = host.querySelector<HTMLFormElement>('[data-lead-form]');
  if (!form) return;
  const tab = trigger.getAttribute(OPEN_LEAD_MODAL_ATTRIBUTE);
  const tabButton = tab
    ? host.querySelector<HTMLElement>(`[data-tab="${CSS.escape(tab)}"]`)
    : null;
  tabButton?.click();
  const service = form.querySelector<HTMLInputElement>(
    `input[type="hidden"][name="${SERVICE_FIELD}"]`,
  );
  const named =
    trigger.getAttribute(LEAD_SERVICE_ATTRIBUTE) ??
    form.getAttribute(DEFAULT_SERVICE_ATTRIBUTE);
  if (service && named !== null) service.value = named;
  if (!host.querySelector(`[${MODAL_FOCUS_ATTRIBUTE}]`))
    host
      .querySelector<HTMLInputElement>(
        '[data-panel]:not([data-tab]):not([hidden]) input',
      )
      ?.focus();
  reachGoal(GOALS.leadModalOpen, {
    tab: tabButton ? tab : 'default',
    service: service?.value || 'none',
  });
}

export function defineLeadModal(tagName: string): void {
  if (armed.has(tagName)) return;
  armed.add(tagName);
  standDownForPageModal(tagName);
  defineModalDialog(tagName);
  document.addEventListener(MODAL_OPEN_EVENT, (event) => {
    const host = event.target;
    if (!(host instanceof HTMLElement) || !host.matches(tagName)) return;
    prepare(host, (event as CustomEvent<ModalOpenDetail>).detail.trigger);
  });
}
