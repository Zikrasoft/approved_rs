import type { FitmentIndex } from '@podbor/shop-catalog/browser';
import { CAR_EVENT, readCar, writeCar, type Car } from './car';

const option = (value: string, label: string): HTMLOptionElement => {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
};

export function defineCarPicker(tagName = 'car-picker'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        if (this.controller) return;
        const data = this.querySelector('script[data-index]');
        const pick = (name: string) =>
          this.querySelector<HTMLSelectElement>(`[data-car="${name}"]`);
        const make = pick('make');
        const model = pick('model');
        const year = pick('year');
        if (!data || !make || !model || !year) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const index = JSON.parse(data.textContent ?? '{}') as FitmentIndex;
        const any = this.dataset.any ?? '';

        const fill = (
          select: HTMLSelectElement,
          values: (string | number)[],
        ) => {
          select.replaceChildren(
            option('', any),
            ...values.map((value) => option(String(value), String(value))),
          );
          select.disabled = values.length === 0;
        };

        const show = (car: Car | null) => {
          make.value = car?.make ?? '';
          if (car && make.value !== car.make) {
            writeCar(null);
            return;
          }
          fill(model, car ? (index.modelsByMake[car.make] ?? []) : []);
          model.value = car?.model ?? '';
          fill(
            year,
            car?.model
              ? (index.yearsByModel[`${car.make}|${car.model}`] ?? [])
              : [],
          );
          year.value = car?.year ? String(car.year) : '';
        };

        const save = () =>
          writeCar(
            make.value
              ? {
                  make: make.value,
                  ...(model.value && { model: model.value }),
                  ...(year.value && { year: Number(year.value) }),
                }
              : null,
          );

        make.addEventListener(
          'change',
          () => {
            model.value = '';
            year.value = '';
            save();
          },
          { signal },
        );
        model.addEventListener(
          'change',
          () => {
            year.value = '';
            save();
          },
          { signal },
        );
        year.addEventListener('change', save, { signal });
        this.querySelector('[data-car-clear]')?.addEventListener(
          'click',
          () => writeCar(null),
          { signal },
        );
        window.addEventListener(
          CAR_EVENT,
          (event) => show((event as CustomEvent<Car | null>).detail),
          { signal },
        );
        show(readCar());
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
