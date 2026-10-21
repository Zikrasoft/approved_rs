export const MY_GARAGE_STORAGE_KEY = 'my_garage_vin';
export const MY_GARAGE_VIN_ATTRIBUTE = 'data-vin-input';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const browserStorage = (): StorageLike => localStorage;

export function storedVin(storage: () => StorageLike = browserStorage): string {
  try {
    return storage().getItem(MY_GARAGE_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberVin(
  vin: string,
  storage: () => StorageLike = browserStorage,
): void {
  try {
    storage().setItem(MY_GARAGE_STORAGE_KEY, vin);
  } catch {
    return;
  }
}

export function defineMyGarage(tagName = 'my-garage'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const input = this.querySelector<HTMLInputElement>(
          `[${MY_GARAGE_VIN_ATTRIBUTE}]`,
        );
        if (!input) return;

        if (!input.value) {
          const vin = storedVin();
          if (vin) input.value = vin;
        }

        input.addEventListener('input', () => {
          if (/[\s.-]/.test(input.value)) {
            input.value = input.value.replace(/[\s.-]+/g, '').toUpperCase();
          }
        });

        this.closest('form')?.addEventListener('submit', () => {
          const value = input.value.trim().toUpperCase();
          if (value) rememberVin(value);
        });
      }
    },
  );
}
