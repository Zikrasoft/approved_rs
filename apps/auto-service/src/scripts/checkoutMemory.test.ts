// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { rememberCheckout, restoreCheckout } from './offerCart';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const checkoutForm = () => {
  const form = document.createElement('form');
  form.innerHTML = `
    <input type="hidden" name="contact_channel" value="whatsapp" />
    <input data-phone />
    <input name="name" />
    <details><input name="vin" /><textarea name="comment"></textarea></details>
  `;
  return form;
};

const field = (form: HTMLFormElement, selector: string) =>
  form.querySelector<HTMLInputElement>(selector)!;

describe('the checkout form after a refused order', () => {
  it('brings back what was typed and shows the VIN it had folded away', () => {
    const storage = memoryStorage();
    const sent = checkoutForm();
    field(sent, '[data-phone]').value = '641234567';
    field(sent, '[name="vin"]').value = 'WBA35BG070N074158';
    rememberCheckout(sent, storage);

    const fresh = checkoutForm();
    restoreCheckout(fresh, storage);

    expect(field(fresh, '[data-phone]').value).toBe('641234567');
    expect(field(fresh, '[name="vin"]').value).toBe('WBA35BG070N074158');
    expect(fresh.querySelector('details')!.open).toBe(true);
  });

  it('keeps the extras folded when nothing was typed there', () => {
    const storage = memoryStorage();
    const sent = checkoutForm();
    field(sent, '[data-phone]').value = '641234567';
    rememberCheckout(sent, storage);

    const fresh = checkoutForm();
    restoreCheckout(fresh, storage);

    expect(fresh.querySelector('details')!.open).toBe(false);
  });
});
