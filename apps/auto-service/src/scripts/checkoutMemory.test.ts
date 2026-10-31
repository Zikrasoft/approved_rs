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

  it('keeps no contact once the order is placed, not even one an earlier visit kept', () => {
    const session = memoryStorage();
    const local = memoryStorage();
    local.setItem(
      'carlab_checkout_contact',
      JSON.stringify({ channel: 'whatsapp', values: { '[data-phone]': '1' } }),
    );
    const sent = checkoutForm();
    field(sent, '[data-phone]').value = '641234567';
    field(sent, '[name="name"]').value = 'Petar';
    rememberCheckout(sent, session);

    forgetCheckout(session, local);
    const next = checkoutForm();
    restoreCheckout(next, session);

    expect(field(next, '[data-phone]').value).toBe('');
    expect(field(next, '[name="name"]').value).toBe('');
    expect(local.getItem('carlab_checkout_contact')).toBeNull();
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
    restoreCheckout(form, blocked);

    expect(field(form, '[data-phone]').value).toBe('');
  });
});
