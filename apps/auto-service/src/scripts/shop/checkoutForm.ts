import { CART_METADATA } from '@podbor/shop-catalog/browser';
import { GOALS, markFieldValidity, reachGoal } from '@podbor/site-kit/browser';
import {
  bindPhoneCountry,
  fillCountrySelect,
} from '@podbor/lead-crm/phone-input';
import {
  deferSubmitUntilKit,
  loadPhoneKit,
  phoneKit,
  phoneValue,
} from '@podbor/lead-crm/phone-kit';
import { isTrackedContactChannel } from '@podbor/lead-crm/contact-channel';
import { phoneInvalid } from '../phone';
import { currentCart, refreshCart } from './cart';
import { checkoutFailure, placeOrder } from './checkout';
import { submitQueue } from './submitQueue';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function defineCheckoutForm(tagName = 'checkout-form'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        if (this.controller) return;
        const form = this.querySelector('form');
        const button = form?.querySelector<HTMLButtonElement>(
          'button[type="submit"]',
        );
        const country =
          form?.querySelector<HTMLSelectElement>('[data-country]');
        const phone = form?.querySelector<HTMLInputElement>('[data-phone]');
        if (!form || !button || !country || !phone) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const errors = JSON.parse(this.dataset.errors ?? '{}') as Record<
          string,
          string
        >;
        const formError = form.querySelector<HTMLElement>('[data-form-error]');
        const submitLabel = form.querySelector<HTMLElement>(
          '[data-submit-label]',
        );
        const input = (name: string) =>
          form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            `[name="${name}"]`,
          );
        const consent = form.querySelector<HTMLInputElement>('[data-consent]');
        form.noValidate = true;
        bindPhoneCountry(country, phone);

        const mark = (key: string, field: HTMLElement, invalid: boolean) => {
          const error = form.querySelector<HTMLElement>(
            `[data-error="${key}"]`,
          );
          if (error) error.hidden = !invalid;
          markFieldValidity(field, !invalid);
        };

        const queue = submitQueue(
          button,
          (error) => {
            if (!formError) return;
            if (error === null) {
              formError.hidden = true;
              return;
            }
            const key = checkoutFailure(error);
            formError.textContent = errors[key] ?? errors.generic ?? '';
            formError.hidden = false;
            if (key === 'stock' || key === 'changed')
              refreshCart().catch((reason: unknown) =>
                console.warn('[checkout] cart not refreshed', reason),
              );
          },
          () => {
            button.disabled = false;
          },
        );

        let started = false;
        form.addEventListener(
          'focusin',
          () => {
            if (started) return;
            started = true;
            reachGoal(GOALS.beginCheckout);
            loadPhoneKit().then(() => {
              const kit = phoneKit();
              if (kit)
                fillCountrySelect(
                  country,
                  kit.countryOptions(country.dataset.displayLocale ?? 'sr-RS'),
                );
            });
          },
          { signal },
        );

        form.addEventListener(
          'submit',
          (event) => {
            event.preventDefault();
            if (deferSubmitUntilKit(form)) return;
            const name = input('name')!;
            const email = input('email')!;
            const typed = phone.value;
            const value = phoneValue(country, phone);
            const checks: [string, HTMLElement, boolean][] = [
              ['name', name, name.value.trim() === ''],
              ['email', email, !EMAIL.test(email.value.trim())],
              ['phone', phone, phoneInvalid(typed, value)],
              [
                'consent',
                consent ?? button,
                consent ? !consent.checked : false,
              ],
            ];
            checks.forEach(([key, field, invalid]) =>
              mark(key, field, invalid),
            );
            const first = checks.find(([, , invalid]) => invalid);
            if (first) {
              first[1].focus();
              return;
            }
            const checkedChannel = form.querySelector<HTMLInputElement>(
              '[name="contact_channel"]:checked',
            )?.value;
            const channel = isTrackedContactChannel(checkedChannel)
              ? checkedChannel
              : 'phone';
            void queue(async () => {
              if (submitLabel && this.dataset.submitting)
                submitLabel.textContent = this.dataset.submitting;
              const order = await placeOrder(
                {
                  name: name.value,
                  email: email.value,
                  phone: value,
                  channel,
                  comment: input('comment')?.value ?? '',
                  website: input(CART_METADATA.honeypot)?.value ?? '',
                },
                currentCart()?.total ?? 0,
              );
              reachGoal(GOALS.orderPlaced, { total: order.total });
              queue.stop();
              this.dispatchEvent(
                new CustomEvent('order-placed', {
                  bubbles: true,
                  detail: { displayId: order.display_id, total: order.total },
                }),
              );
            });
          },
          { signal },
        );
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
