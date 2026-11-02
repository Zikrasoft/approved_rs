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
        const model = this.querySelector<HTMLSelectElement>('[name=model]');
        const { href } = this.dataset;
        if (!make || !model || !href) return;
        const [placeholder, ...groups] = [...model.children] as HTMLElement[];

        const showModels = () => {
          const chosen = model.value;
          model.replaceChildren(
            placeholder,
            ...groups.filter(
              ({ dataset }) => !make.value || dataset.make === make.value,
            ),
          );
          model.value = [...model.options].some(({ value }) => value === chosen)
            ? chosen
            : '';
        };
        const choose = (makeSlug: string, modelSlug: string) => {
          make.value = makeSlug;
          showModels();
          model.value = modelSlug;
        };

        make.addEventListener('change', showModels);
        model.addEventListener('change', () => {
          const owner = groupOf(model.selectedOptions[0]);
          if (owner && owner !== make.value) choose(owner, model.value);
        });
        this.querySelector('form')?.addEventListener('submit', (event) => {
          if (!model.value) return;
          event.preventDefault();
          location.assign(
            href.replace('{make}', make.value).replace('{model}', model.value),
          );
        });

        const garage = rememberedCar();
        const listed = [...model.options].find(
          (option) =>
            option.value === garage?.model && groupOf(option) === garage.make,
        );
        if (garage?.make && listed) choose(garage.make, listed.value);
      }
    },
  );
}
