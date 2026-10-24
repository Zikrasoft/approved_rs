import { PRICES_FILLED_EVENT, shopPreview } from './shopPreview';

let queued: HTMLElement[] = [];

const request = (slot: HTMLElement) => ({
  kind: slot.dataset.kind,
  ...JSON.parse(slot.dataset.fields ?? '{}'),
});

async function fill(slots: HTMLElement[]): Promise<void> {
  try {
    const response = await fetch(slots[0].dataset.src ?? '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slots: slots.map(request) }),
    });
    if (response.status !== 200) return;
    const rendered = new DOMParser().parseFromString(
      await response.text(),
      'text/html',
    );
    slots.forEach((slot, index) => {
      const content = rendered.querySelector<HTMLTemplateElement>(
        `template[data-slot="${index}"]`,
      )?.content;
      if (content?.childElementCount) {
        slot.replaceChildren(document.importNode(content, true));
      }
    });
    document.dispatchEvent(new Event(PRICES_FILLED_EVENT));
  } catch {
    return;
  }
}

export function definePriceSlots(tagName = 'price-slot'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        if (
          this.dataset.queued !== undefined ||
          (this.dataset.fresh === undefined && !shopPreview())
        )
          return;
        this.dataset.queued = '';
        if (queued.length === 0) {
          queueMicrotask(() => {
            const slots = queued;
            queued = [];
            void fill(slots);
          });
        }
        queued.push(this);
      }
    },
  );
}
