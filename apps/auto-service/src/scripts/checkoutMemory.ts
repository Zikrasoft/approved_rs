import * as z from 'zod/mini';
import {
  forgetStored,
  readStoredJson,
  writeStoredJson,
  type ValueStorage as CartStorage,
} from '@podbor/site-kit/stored-value';

const CHECKOUT_MEMORY_KEY = 'carlab_checkout_form';
const CONTACT_MEMORY_KEY = 'carlab_checkout_contact';
const REMEMBERED_FIELDS = [
  '[data-country]',
  '[data-phone]',
  '[data-telegram]',
  '[name="name"]',
  '[name="vin"]',
  '[name="comment"]',
  '[data-consent]',
  '[name="contact"]',
] as const;

const fieldIn = (form: HTMLFormElement, selector: string) =>
  form.querySelector<HTMLInputElement | HTMLSelectElement>(selector);

const fieldValue = (field: HTMLInputElement | HTMLSelectElement | null) =>
  field instanceof HTMLInputElement && field.type === 'checkbox'
    ? field.checked
      ? field.value
      : ''
    : (field?.value ?? '');

const checkoutMemorySchema = z.object({
  values: z.record(z.string(), z.string()),
  channel: z.string(),
});

type CheckoutMemory = z.infer<typeof checkoutMemorySchema>;

const readMemory = (storage: CartStorage, key: string): CheckoutMemory | null =>
  readStoredJson(key, checkoutMemorySchema, null, storage);

const writeMemory = (
  storage: CartStorage,
  key: string,
  memory: CheckoutMemory,
) => writeStoredJson(key, memory, storage);

export function rememberCheckout(
  form: HTMLFormElement,
  storage: CartStorage = sessionStorage,
): void {
  writeMemory(storage, CHECKOUT_MEMORY_KEY, {
    values: Object.fromEntries(
      REMEMBERED_FIELDS.map((selector) => [
        selector,
        fieldValue(fieldIn(form, selector)),
      ]),
    ),
    channel:
      form.querySelector<HTMLInputElement>('[name="contact_channel"]')?.value ??
      '',
  });
}

export function checkoutContact(
  storage: CartStorage = sessionStorage,
): { channel: string; contact: string } | null {
  const memory = readMemory(storage, CHECKOUT_MEMORY_KEY);
  const contact = memory?.values['[name="contact"]'];
  return memory && contact ? { channel: memory.channel, contact } : null;
}

export function forgetCheckout(
  session: CartStorage = sessionStorage,
  local: CartStorage = localStorage,
): void {
  forgetStored(CHECKOUT_MEMORY_KEY, session);
  forgetStored(CONTACT_MEMORY_KEY, local);
}

export function restoreCheckout(
  form: HTMLFormElement,
  session: CartStorage = sessionStorage,
): void {
  const memory = readMemory(session, CHECKOUT_MEMORY_KEY);
  if (!memory) return;
  if (memory.channel) {
    form
      .querySelector<HTMLElement>(`[data-tab="${CSS.escape(memory.channel)}"]`)
      ?.click();
  }
  for (const [selector, value] of Object.entries(memory.values)) {
    const field = fieldIn(form, selector);
    if (!field || !value) continue;
    if (field instanceof HTMLInputElement && field.type === 'checkbox') {
      field.checked = true;
    } else {
      field.value = value;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const folded = field.closest('details');
    if (folded) folded.open = true;
  }
}
