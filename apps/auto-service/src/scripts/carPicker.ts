import { rememberedCar } from './garageCar';

const groupOf = (option: HTMLOptionElement) =>
  option.closest('optgroup')?.dataset.make;

export function defineCarPicker(tagName = 'car-picker'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const make = this.querySelector<HTMLSelectElement>('[name=make]');
        const series = this.querySelector<HTMLSelectElement>('[name=series]');
        const { href } = this.dataset;
        if (!make || !series || !href) return;
        const [placeholder, ...groups] = [...series.children] as HTMLElement[];

        const showSeries = () => {
          const chosen = series.value;
          series.replaceChildren(
            placeholder,
            ...groups.filter(
              ({ dataset }) => !make.value || dataset.make === make.value,
            ),
          );
          series.value = [...series.options].some(
            ({ value }) => value === chosen,
          )
            ? chosen
            : '';
        };
        const choose = (makeSlug: string, seriesSlug: string) => {
          make.value = makeSlug;
          showSeries();
          series.value = seriesSlug;
        };

        make.addEventListener('change', showSeries);
        series.addEventListener('change', () => {
          const owner = groupOf(series.selectedOptions[0]);
          if (owner && owner !== make.value) choose(owner, series.value);
        });
        this.querySelector('form')?.addEventListener('submit', (event) => {
          if (!series.value) return;
          event.preventDefault();
          location.assign(
            href
              .replace('{make}', make.value)
              .replace('{series}', series.value),
          );
        });

        const garage = rememberedCar();
        const listed = [...series.options].find(
          (option) =>
            option.value === garage?.series && groupOf(option) === garage.make,
        );
        if (garage?.make && listed) choose(garage.make, listed.value);
      }
    },
  );
}
