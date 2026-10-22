export function defineVinCheck(tagName = 'vin-check'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const input = this.querySelector('input');
        if (!input) return;
        input.addEventListener('invalid', () => {
          if (!input.validity.customError) {
            input.setCustomValidity(this.dataset.message ?? '');
          }
        });
        input.addEventListener('input', () => input.setCustomValidity(''));
      }
    },
  );
}
