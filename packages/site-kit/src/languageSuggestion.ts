import { GOALS, reachGoal } from './goals.ts';

export const LANGUAGE_SUGGESTION_STORAGE_KEY = 'language-suggestion-dismissed';

export interface LanguageLabels {
  switchTo: string;
  dismiss: string;
}

export const LANGUAGE_LABELS: Record<string, LanguageLabels> = {
  ru: { switchTo: 'Показать на русском', dismiss: 'Закрыть' },
  en: { switchTo: 'View in English', dismiss: 'Dismiss' },
  sr: { switchTo: 'Prikaži na srpskom', dismiss: 'Zatvori' },
  es: { switchTo: 'Ver en español', dismiss: 'Cerrar' },
  de: { switchTo: 'Auf Deutsch anzeigen', dismiss: 'Schließen' },
};

const subtag = (tag: string): string => tag.toLowerCase().split('-')[0]!;

export function preferredAlternate(
  current: string,
  preferences: readonly string[],
  available: readonly string[],
): string | undefined {
  const here = subtag(current);
  const offered = new Map(available.map((tag) => [subtag(tag), tag]));
  for (const preference of preferences) {
    const wanted = subtag(preference);
    if (wanted === here) return undefined;
    const match = offered.get(wanted);
    if (match) return match;
  }
  return undefined;
}

export function pageAlternates(doc: Document): Map<string, string> {
  const alternates = new Map<string, string>();
  doc
    .querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')
    .forEach((link) => {
      const tag = link.hreflang;
      if (tag && tag !== 'x-default' && !alternates.has(tag))
        alternates.set(tag, link.href);
    });
  return alternates;
}

function dismissed(): boolean {
  try {
    return localStorage.getItem(LANGUAGE_SUGGESTION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    localStorage.setItem(LANGUAGE_SUGGESTION_STORAGE_KEY, '1');
  } catch {
    // TODO: private mode loses the answer, so the offer returns next visit.
  }
}

export function defineLanguageSuggestion(
  tagName = 'language-suggestion',
): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        this.controller?.abort();
        this.controller = new AbortController();
        const { signal } = this.controller;

        const link = this.querySelector<HTMLAnchorElement>('[data-lang-link]');
        const close = this.querySelector<HTMLElement>('[data-lang-dismiss]');
        if (!link || dismissed()) return;

        const alternates = pageAlternates(this.ownerDocument);
        const offer = preferredAlternate(
          this.ownerDocument.documentElement.lang,
          navigator.languages ?? [],
          [...alternates.keys()],
        );
        const labels = offer && LANGUAGE_LABELS[subtag(offer)];
        if (!offer || !labels) return;

        link.href = alternates.get(offer)!;
        link.hreflang = offer;
        link.lang = offer;
        link.textContent = labels.switchTo;
        close?.setAttribute('aria-label', labels.dismiss);
        this.hidden = false;

        const from = subtag(this.ownerDocument.documentElement.lang);
        const to = subtag(offer);
        reachGoal(GOALS.langOfferShown, { from, to });

        this.addEventListener(
          'click',
          (event) => {
            const target = event.target as Element | null;
            if (target?.closest('[data-lang-link]')) {
              remember();
              reachGoal(GOALS.langOfferTaken, { from, to });
              return;
            }
            if (!target?.closest('[data-lang-dismiss]')) return;
            remember();
            reachGoal(GOALS.langOfferDismissed, { from, to });
            this.hidden = true;
          },
          { signal },
        );
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
