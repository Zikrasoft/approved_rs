import { vinText } from '@podbor/lead-crm/vin';
import { readStored, writeStored } from './storedValue.ts';

type VinStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const MY_GARAGE_STORAGE_KEY = 'my_garage_vin';
export const MY_GARAGE_VIN_ATTRIBUTE = 'data-vin-input';

export const storedVin = (storage?: VinStorage): string =>
  readStored(MY_GARAGE_STORAGE_KEY, storage) ?? '';

export function rememberVin(vin: string, storage?: VinStorage): void {
  writeStored(MY_GARAGE_STORAGE_KEY, vin, storage);
  for (const input of document.querySelectorAll<HTMLInputElement>(
    `[${MY_GARAGE_VIN_ATTRIBUTE}]`,
  )) {
    if (!input.value) input.value = vin;
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
        input.addEventListener('blur', () => {
          input.value = vinText(input.value);
        });
      }
    },
  );
}
