export function defineVinCheck(tagName = 'vin-check'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const input = this.querySelector('input');
        if (!input) return;
        const error = document.createElement('p');
        error.className =
          'mt-1.5 text-sm text-signal-dark sm:col-start-1 sm:row-start-2';
        error.setAttribute('role', 'alert');
        error.hidden = true;
        this.append(error);
        input.addEventListener('invalid', (event) => {
          event.preventDefault();
          input.focus();
          if (!input.validity.customError) {
            input.setCustomValidity(this.dataset.message ?? '');
          }
          input.setAttribute('aria-invalid', 'true');
          error.textContent = input.validationMessage;
          error.hidden = false;
        });
        input.addEventListener('input', () => {
          input.setCustomValidity('');
          input.removeAttribute('aria-invalid');
          error.hidden = true;
        });
      }
    },
  );
}
