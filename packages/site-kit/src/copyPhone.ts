export const COPY_PHONE_NUMBER_ATTRIBUTE = 'data-copy-number';
export const COPY_PHONE_DIGITS_ATTRIBUTE = 'data-copy-digits';
export const COPY_PHONE_STATUS_ATTRIBUTE = 'data-copy-status';
export const COPY_PHONE_SHOWN_MS = 2000;

export function defineCopyPhone(tagName = 'copy-phone'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      #timer?: ReturnType<typeof setTimeout>;

      connectedCallback(): void {
        this.querySelector('button')!.addEventListener('click', this.#copy);
      }

      #copy = (): void => {
        const number = this.getAttribute(COPY_PHONE_NUMBER_ATTRIBUTE)!;
        const clipboard = navigator.clipboard as Clipboard | undefined;
        if (!clipboard) return this.#select();
        clipboard.writeText(number).then(this.#confirm, this.#select);
      };

      #select = (): void => {
        getSelection()!.selectAllChildren(
          this.querySelector(`[${COPY_PHONE_DIGITS_ATTRIBUTE}]`)!,
        );
      };

      #confirm = (): void => {
        const status = this.querySelector(`[${COPY_PHONE_STATUS_ATTRIBUTE}]`)!;
        status.textContent = status.getAttribute(COPY_PHONE_STATUS_ATTRIBUTE);
        clearTimeout(this.#timer);
        this.#timer = setTimeout(() => {
          status.textContent = '';
        }, COPY_PHONE_SHOWN_MS);
      };
    },
  );
}
