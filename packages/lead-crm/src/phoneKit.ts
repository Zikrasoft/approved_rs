export interface PhoneKit {
  AsYouType: typeof import('libphonenumber-js/min').AsYouType;
  parse: typeof import('libphonenumber-js/min').parsePhoneNumberFromString;
  isValidContact: typeof import('./phone.ts').isValidContact;
}

// A stalled request is not a rejected one: the module can hang on a flaky
// mobile connection or behind a captive portal and never settle, and a form
// waiting on it would swallow every submit with no spinner and no error.
const LOAD_TIMEOUT_MS = 4000;
const AWAITING = 'awaitingKit';

let kit: PhoneKit | null = null;
let unavailable = false;
let loading: Promise<void> | null = null;

export const phoneKit = (): PhoneKit | null => kit;

export function loadPhoneKit(): Promise<void> {
  loading ??= Promise.all([
    import('libphonenumber-js/min'),
    import('./phone.ts'),
  ])
    .then(([phone, crm]) => {
      kit = {
        AsYouType: phone.AsYouType,
        parse: phone.parsePhoneNumberFromString,
        isValidContact: crm.isValidContact,
      };
    })
    .catch(() => {
      unavailable = true;
    });
  return loading;
}

export function deferSubmitUntilKit(form: HTMLFormElement): boolean {
  if (kit || unavailable) return false;
  if (!form.dataset[AWAITING]) {
    form.dataset[AWAITING] = '1';
    Promise.race([
      loadPhoneKit(),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          unavailable = true;
          resolve();
        }, LOAD_TIMEOUT_MS),
      ),
    ]).then(() => {
      delete form.dataset[AWAITING];
      form.requestSubmit();
    });
  }
  return true;
}
