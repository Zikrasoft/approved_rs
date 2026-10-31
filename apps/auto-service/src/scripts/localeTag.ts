export const localeTagOf = (element: HTMLElement): string =>
  element.dataset.localeTag || document.documentElement.lang;
