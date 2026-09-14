export const LOCALE_COOKIE = 'lang';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const LOCALE_CHOICE_ATTRIBUTE = 'data-lang-choice';

export function localeCookieValue(locale: string): string {
  return `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

export function defineLocaleChoice(tagName = 'locale-choice'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        this.addEventListener('click', (event) => {
          const chosen = (
            event.target as HTMLElement | null
          )?.closest<HTMLElement>(`[${LOCALE_CHOICE_ATTRIBUTE}]`)?.dataset
            .langChoice;
          if (chosen) document.cookie = localeCookieValue(chosen);
        });
      }
    },
  );
}
