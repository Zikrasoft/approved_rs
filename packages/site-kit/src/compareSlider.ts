const COMPARE_SPLIT_VAR = '--split';

export function defineCompareSlider(tagName = 'compare-slider'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private bound = false;

      connectedCallback(): void {
        const input = this.querySelector<HTMLInputElement>(
          'input[type="range"]',
        );
        if (!input || this.bound) return;
        this.bound = true;
        const apply = () =>
          this.style.setProperty(COMPARE_SPLIT_VAR, `${input.value}%`);
        input.addEventListener('input', apply);
        apply();
      }
    },
  );
}
