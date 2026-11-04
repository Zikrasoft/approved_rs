import { OPEN_LEAD_MODAL_ATTRIBUTE } from '@podbor/site-kit/lead-form';

export const CALLBACK_HEADING_ATTRIBUTE = 'data-callback-heading';
const CALLBACK_TAB = 'phone';

const armed = new Set<string>();

const retitle = (host: HTMLElement, callback: boolean): void => {
  const heading = host.querySelector('h2');
  const dialog = host.querySelector('dialog');
  if (!heading || !dialog) return;
  host.dataset.heading ??= heading.textContent ?? '';
  const title = callback
    ? host.getAttribute(CALLBACK_HEADING_ATTRIBUTE)!
    : host.dataset.heading;
  heading.textContent = title;
  dialog.setAttribute('aria-label', title);
};

export function defineCallbackHeading(tagName: string): void {
  if (armed.has(tagName)) return;
  armed.add(tagName);
  document.addEventListener(
    'click',
    (event) => {
      const trigger =
        event.target instanceof Element
          ? event.target.closest(`[${OPEN_LEAD_MODAL_ATTRIBUTE}]`)
          : null;
      if (!trigger) return;
      const callback =
        trigger.getAttribute(OPEN_LEAD_MODAL_ATTRIBUTE) === CALLBACK_TAB;
      for (const host of document.querySelectorAll<HTMLElement>(
        `${tagName}[${CALLBACK_HEADING_ATTRIBUTE}]`,
      ))
        retitle(host, callback);
    },
    { capture: true },
  );
}
