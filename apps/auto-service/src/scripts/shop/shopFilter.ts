import {
  fitmentMatches,
  matchesFacets,
  readFacetState,
  writeFacetState,
  type FitmentEntry,
  type ProductTypeDef,
  type Spec,
} from '@podbor/shop-catalog/browser';
import { pluralLabel, type PluralForms } from '@/utils/plural';
import { CAR_EVENT, readCar } from './car';

export function defineShopFilter(tagName = 'shop-filter'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        if (this.controller) return;
        const typeDef = this.dataset.typeDef;
        const form = this.querySelector<HTMLFormElement>('form[data-facets]');
        const items = [...this.querySelectorAll<HTMLElement>('[data-product]')];
        if (!typeDef || !form || items.length === 0) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const type = JSON.parse(typeDef) as ProductTypeDef;
        const count = this.querySelector<HTMLElement>('[data-filter-count]');
        const empty = this.querySelector<HTMLElement>('[data-filter-empty]');
        const forms = JSON.parse(
          this.dataset.countForms ?? '{"other":"{count}"}',
        ) as PluralForms;
        const bcp47 = this.dataset.bcp47 ?? 'sr-Latn-RS';
        const usesCar = type.fitment !== 'none';
        const facetKeys = type.fields
          .filter((field) => field.facet)
          .flatMap((field) =>
            field.kind === 'number'
              ? [`${field.key}.min`, `${field.key}.max`]
              : [field.key],
          );
        const entries = items.map((item) => ({
          item,
          spec: JSON.parse(item.dataset.spec ?? '{}') as Spec,
          fitment: JSON.parse(item.dataset.fitment ?? '[]') as FitmentEntry[],
        }));

        const restore = () => {
          const state = readFacetState(
            type,
            new URLSearchParams(location.search),
          );
          for (const input of form.querySelectorAll<HTMLInputElement>(
            'input[name]',
          )) {
            if (input.type === 'checkbox') {
              input.checked =
                state[input.name]?.values?.includes(input.value) ?? false;
              continue;
            }
            const [key, bound] = input.name.split('.');
            const value = state[key]?.[bound as 'min' | 'max'];
            input.value = value === undefined ? '' : String(value);
          }
        };

        const apply = () => {
          const params = new URLSearchParams();
          for (const [key, value] of new FormData(form))
            if (typeof value === 'string' && value.trim() !== '')
              params.append(key, value);
          const state = readFacetState(type, params);
          const next = new URLSearchParams(location.search);
          for (const key of facetKeys) next.delete(key);
          for (const [key, value] of writeFacetState(type, state))
            next.append(key, value);
          const query = next.toString();
          if (query !== new URLSearchParams(location.search).toString()) {
            history.replaceState(
              history.state,
              '',
              query ? `?${query}` : location.pathname,
            );
          }
          const car = usesCar ? readCar() : null;
          let shown = 0;
          for (const { item, spec, fitment } of entries) {
            const visible =
              matchesFacets(type, spec, state) &&
              (!car || fitmentMatches(fitment, car));
            item.hidden = !visible;
            if (visible) shown += 1;
          }
          if (count) count.textContent = pluralLabel(forms, bcp47, shown);
          empty?.toggleAttribute('hidden', shown > 0);
        };

        form.addEventListener('change', apply, { signal });
        form.addEventListener(
          'submit',
          (event) => {
            event.preventDefault();
            apply();
          },
          { signal },
        );
        this.querySelector('[data-filter-reset]')?.addEventListener(
          'click',
          () => {
            form.reset();
            apply();
          },
          { signal },
        );
        window.addEventListener(CAR_EVENT, apply, { signal });
        restore();
        apply();
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
