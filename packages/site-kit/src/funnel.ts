import { AWAITING_KIT_ATTRIBUTE } from '@podbor/lead-crm/phone-kit';
import { FIELD_NAME_ATTRIBUTE, INVALID_ATTRIBUTE } from './fieldValidity.ts';
import { SERVICE_FIELD } from '@podbor/lead-crm/fields';
import { GOALS, reachGoal } from './goals.ts';

export const LEAD_FORM_ATTRIBUTE = 'data-lead-form';
export const BRAND_LINK_ATTRIBUTE = 'data-brand-link';

const SCROLL_MARKS = [
  [50, GOALS.scroll50],
  [90, GOALS.scroll90],
] as const;

export function scrolledPercent(): number {
  const scrollable = document.documentElement.scrollHeight - innerHeight;
  if (scrollable <= 0) return 100;
  return Math.round((scrollY / scrollable) * 100);
}

export function submittedService(form: HTMLFormElement): string {
  const service = form.querySelector<HTMLInputElement>(
    `input[name="${SERVICE_FIELD}"]`,
  );
  return service?.value || 'none';
}

export function fieldName(control: HTMLElement): string {
  return (
    control.getAttribute(FIELD_NAME_ATTRIBUTE) ??
    control.getAttribute('name') ??
    'unknown'
  );
}

function trackScroll(signal: AbortSignal): void {
  const pending = new Set<(typeof SCROLL_MARKS)[number]>(SCROLL_MARKS);
  const controller = new AbortController();
  signal.addEventListener('abort', () => controller.abort());

  const check = (): void => {
    const reached = scrolledPercent();
    for (const mark of pending) {
      const [depth, goal] = mark;
      if (reached < depth) continue;
      pending.delete(mark);
      reachGoal(goal);
    }
    if (!pending.size) controller.abort();
  };

  addEventListener('scroll', check, {
    passive: true,
    signal: controller.signal,
  });
  addEventListener('load', check, { signal: controller.signal });
  check();
}

function trackForms(signal: AbortSignal): void {
  const forms = document.querySelectorAll<HTMLFormElement>(
    `[${LEAD_FORM_ATTRIBUTE}]`,
  );
  if (!forms.length) return;

  let started = false;

  const seen = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    seen.disconnect();
    reachGoal(GOALS.formView);
  });
  signal.addEventListener('abort', () => seen.disconnect());

  forms.forEach((form) => {
    seen.observe(form);

    form.addEventListener(
      'input',
      () => {
        if (started) return;
        started = true;
        reachGoal(GOALS.formStart);
      },
      { signal },
    );
  });

  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target as HTMLFormElement;
      if (!form.matches(`[${LEAD_FORM_ATTRIBUTE}]`)) return;
      if (!event.defaultPrevented) {
        reachGoal(GOALS.formSubmit, { service: submittedService(form) });
        return;
      }
      if (form.hasAttribute(AWAITING_KIT_ATTRIBUTE)) return;
      const invalid = form.querySelector<HTMLElement>(
        `[${INVALID_ATTRIBUTE}="true"]`,
      );
      if (invalid) reachGoal(GOALS.formError, { field: fieldName(invalid) });
    },
    { signal },
  );
}

function trackBrandLinks(signal: AbortSignal): void {
  document.addEventListener(
    'click',
    (event) => {
      const link = (event.target as Element | null)?.closest<HTMLElement>(
        `[${BRAND_LINK_ATTRIBUTE}]`,
      );
      if (!link) return;
      reachGoal(GOALS.brandLinkClick, {
        to: link.getAttribute(BRAND_LINK_ATTRIBUTE),
      });
    },
    { signal },
  );
}

let armed = false;

export function defineFunnelTracking(
  signal: AbortSignal = new AbortController().signal,
): void {
  if (armed) return;
  armed = true;
  signal.addEventListener('abort', () => {
    armed = false;
  });
  trackScroll(signal);
  trackForms(signal);
  trackBrandLinks(signal);
}
