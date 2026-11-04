import { positionGroups } from '@podbor/catalog-contract/ambiguity';
import { rememberVin } from '@podbor/site-kit/browser';
import { steeringSide, vinFactsFrom, vinFrom } from '@/utils/carFacts';
import { rememberCar } from './garageCar';

const fitmentRows = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>('[data-fitment]')].map((element) => ({
    element,
    part_id: element.dataset.partId ?? '',
    steering: steeringSide(element.dataset.steering),
    note: element.dataset.note ?? null,
    category_id: null,
    axle: null,
    side: null,
  }));

export function defineCarFacts(tagName = 'car-facts'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      confirmVin(vin: string): void {
        const line = document.querySelector<HTMLElement>('[data-vin-matched]');
        const text = line?.querySelector<HTMLElement>('[data-template]');
        if (!line || !text) return;
        text.textContent = (text.dataset.template ?? '').replace('{vin}', vin);
        line.hidden = false;
        const closing = this.querySelector<HTMLElement>('[data-not-your-car]');
        if (closing) closing.hidden = true;
      }

      connectedCallback(): void {
        for (const link of document.querySelectorAll('[data-forget-vin]')) {
          link.addEventListener('click', () => rememberVin(''));
        }
        const vin = vinFrom(location.search);
        if (vin) {
          rememberVin(vin);
          const { car, make, model } = this.dataset;
          if (car) rememberCar({ vin, car, make, model });
          this.confirmVin(vin);
        }

        const facts = vinFactsFrom(location.search);
        if (!facts.steering) return;

        for (const group of this.querySelectorAll<HTMLElement>(
          '[data-position-group]',
        )) {
          const rows = fitmentRows(group);
          const [kept] = positionGroups(rows, facts);
          for (const row of rows) {
            row.element.hidden = !kept?.fitments.includes(row);
          }
          group.hidden = !kept;
          group.toggleAttribute('data-ambiguous', Boolean(kept?.ambiguous));
        }

        const rows = fitmentRows(this);
        const fitted = new Set(rows.map(({ part_id }) => part_id));
        const shown = new Set(
          rows
            .filter(({ element }) => !element.hidden)
            .map(({ part_id }) => part_id),
        );
        for (const item of this.querySelectorAll<HTMLElement>(
          '[data-kit-part]',
        )) {
          const partId = item.dataset.kitPart ?? '';
          item.hidden = fitted.has(partId) && !shown.has(partId);
        }

        const note = this.querySelector<HTMLElement>('[data-vin-steering]');
        if (note) {
          note.textContent = (note.dataset.template ?? '').replace(
            '{side}',
            note.dataset[facts.steering] ?? '',
          );
          note.hidden = false;
        }
      }
    },
  );
}
