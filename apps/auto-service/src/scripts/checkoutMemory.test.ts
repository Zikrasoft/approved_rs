// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { forgetCheckout, rememberCheckout, restoreCheckout } from './offerCart';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

const checkoutForm = () => {
  const form = document.createElement('form');
  form.innerHTML = `
    <input type="hidden" name="contact_channel" value="whatsapp" />
    <input data-phone />
    <input name="name" />
    <input type="checkbox" data-consent />
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

describe('the checkout form', () => {
  it('keeps the consent the visitor gave before the order came back', () => {
    const storage = memoryStorage();
    const sent = checkoutForm();
    field(sent, '[data-consent]').checked = true;
    rememberCheckout(sent, storage);

    const fresh = checkoutForm();
    restoreCheckout(fresh, storage);

    expect(field(fresh, '[data-consent]').checked).toBe(true);
  });

  it('offers the contact of the last order on the next checkout', () => {
    const session = memoryStorage();
    const local = memoryStorage();
    const sent = checkoutForm();
    field(sent, '[data-phone]').value = '641234567';
    field(sent, '[name="name"]').value = 'Petar';
    field(sent, '[name="vin"]').value = 'WBA35BG070N074158';
    field(sent, '[data-consent]').checked = true;
    rememberCheckout(sent, session);

    forgetCheckout(session, local);
    const next = checkoutForm();
    restoreCheckout(next, session, local);

    expect(field(next, '[data-phone]').value).toBe('641234567');
    expect(field(next, '[name="name"]').value).toBe('Petar');
    expect(field(next, '[name="vin"]').value).toBe('');
    expect(field(next, '[data-consent]').checked).toBe(false);
  });

  it('starts empty when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const form = checkoutForm();
    rememberCheckout(form, blocked);
    forgetCheckout(blocked, blocked);
    restoreCheckout(form, blocked, blocked);

    expect(field(form, '[data-phone]').value).toBe('');
  });
});
