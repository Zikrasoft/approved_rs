import type { CountryCode } from 'libphonenumber-js/min';
import type { TrackedContactChannel } from './contactChannel.ts';
import {
  bindPhoneCountry,
  fillCountrySelect,
  selectCountry,
} from './phoneInput.ts';
import {
  deferSubmitUntilKit,
  loadPhoneKit,
  phoneKit,
  showContactValue,
} from './phoneKit.ts';
import { submitLeadForm } from './submitLeadForm.ts';

export interface LeadFormDeps {
  visitorId: () => string;
  markFieldValidity: (control: Element, valid: boolean) => void;
  preferredChannel?: () => TrackedContactChannel | undefined;
  visitorCountry?: () => string | undefined;
}

type ValidatedField = 'telegram' | 'phone' | 'consent';

const ARMED_ATTRIBUTE = 'data-armed';

export function defineLeadForm(
  deps: LeadFormDeps,
  tagName = 'lead-form',
): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const form = this.querySelector('form');
        if (!form || form.hasAttribute(ARMED_ATTRIBUTE)) return;
        form.setAttribute(ARMED_ATTRIBUTE, '');
        arm(form, deps);
      }
    },
  );
}

function arm(form: HTMLFormElement, deps: LeadFormDeps): void {
  const pick = <T extends Element = HTMLElement>(selector: string): T =>
    form.querySelector<T>(selector)!;

  form.noValidate = true;
  const telegram = pick<HTMLInputElement>('[data-telegram]');
  const country = pick<HTMLSelectElement>('[data-country]');
  const phone = pick<HTMLInputElement>('[data-phone]');
  const consent = pick<HTMLInputElement>('[data-consent]');
  const contact = pick<HTMLInputElement>(
    'input[type="hidden"][name="contact"]',
  );
  const channelField = pick<HTMLInputElement>(
    'input[type="hidden"][name="contact_channel"]',
  );
  const button = pick<HTMLButtonElement>('button[type="submit"]');
  const submitLabel = pick('[data-submit-label]');
  const idleLabel = submitLabel.textContent;
  const submitError = pick('[data-error-submit]');
  const tabs = Array.from(form.querySelectorAll<HTMLElement>('[data-tab]'));
  const panels = Array.from(
    form.querySelectorAll<HTMLElement>('[data-panel]:not([data-tab])'),
  );
  const controls = { telegram, phone, consent };
  const errors = {
    telegram: pick('[data-error-telegram]'),
    phone: pick('[data-error-phone]'),
    consent: pick('[data-error-consent]'),
  };

  let channel = channelField.value as TrackedContactChannel;
  const contactField = (): ValidatedField =>
    channel === 'telegram' ? 'telegram' : 'phone';

  const mark = (field: ValidatedField, valid: boolean): void => {
    errors[field].hidden = valid;
    deps.markFieldValidity(controls[field], valid);
  };

  const selectTab = (tab: HTMLElement): void => {
    channel = tab.dataset.tab as TrackedContactChannel;
    channelField.value = channel;
    tabs.forEach((other) =>
      other.setAttribute('aria-selected', String(other === tab)),
    );
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab.dataset.panel;
    });
    mark('telegram', true);
    mark('phone', true);
  };

  // TODO: re-masks from raw digits on every keystroke; a caret-aware mask if the caret jump bites.
  const maskPhone = (): void => {
    const kit = phoneKit();
    if (!kit) return;
    const typed = phone.value.trim();
    const digits = typed.replace(/\D/g, '');
    phone.value = typed.startsWith('+')
      ? new kit.AsYouType().input(`+${digits}`)
      : new kit.AsYouType(country.value as CountryCode).input(digits);
  };

  const expandCountries = (): Promise<void> =>
    loadPhoneKit().then(() => {
      const kit = phoneKit();
      if (kit)
        fillCountrySelect(
          country,
          kit.countryOptions(country.dataset.displayLocale!),
        );
    });

  const setBusy = (busy: boolean): void => {
    button.disabled = busy;
    if (busy) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
    submitLabel.textContent = busy
      ? (form.dataset.submittingLabel ?? idleLabel)
      : idleLabel;
  };

  selectCountry(country, deps.visitorCountry?.());
  bindPhoneCountry(country, phone);

  const preferred = deps.preferredChannel?.();
  selectTab(
    tabs.find((tab) => tab.dataset.tab === preferred) ??
      tabs.find((tab) => tab.dataset.tab === channel)!,
  );

  tabs.forEach((tab) =>
    tab.addEventListener('click', (event) => {
      selectTab(tab);
      if (event.isTrusted) controls[contactField()].focus();
    }),
  );

  form.addEventListener('focusin', () => void expandCountries(), {
    once: true,
  });
  form.addEventListener('pointerenter', () => void expandCountries(), {
    once: true,
  });
  form.addEventListener('input', () => {
    (Object.keys(errors) as ValidatedField[]).forEach((field) =>
      mark(field, true),
    );
    submitError.hidden = true;
  });
  phone.addEventListener('input', maskPhone);
  country.addEventListener('change', maskPhone);
  telegram.addEventListener('blur', () => {
    showContactValue('telegram', country, telegram);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (deferSubmitUntilKit(form)) return;
    pick<HTMLInputElement>('[data-visitor-id]').value = deps.visitorId();
    pick<HTMLInputElement>('[data-source-url]').value = location.href;

    const field = contactField();
    const input = controls[field];
    const typed = input.value.trim();
    contact.value = showContactValue(channel, country, input);
    const kit = phoneKit();
    const contactValid =
      typed.length > 0 && (!kit || kit.isValidContact(contact.value, channel));
    mark(field, contactValid);
    mark('consent', consent.checked);

    if (!contactValid || !consent.checked) {
      (contactValid ? consent : input).focus();
      return;
    }

    submitError.hidden = true;
    setBusy(true);
    void submitLeadForm(form).then((sent) => {
      if (sent) return;
      setBusy(false);
      submitError.hidden = false;
    });
  });
}
