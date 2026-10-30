import { positionGroups } from '@podbor/catalog-contract/ambiguity';
import { rememberVin } from '@podbor/site-kit/browser';
import { steeringSide, vinFactsFrom, vinFrom } from '@/utils/carFacts';

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
      connectedCallback(): void {
        const vin = vinFrom(location.search);
        if (vin) rememberVin(vin);

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
