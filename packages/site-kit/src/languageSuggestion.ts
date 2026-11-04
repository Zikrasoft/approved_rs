import { GOALS, reachGoal } from './goals.ts';
import { LOCALE_CHOICE_ATTRIBUTE } from './localeCookie.ts';

export const LANGUAGE_SUGGESTION_STORAGE_KEY = 'language-suggestion-dismissed';

export const LANGUAGE_SUGGESTED_ATTRIBUTE = 'data-lang-suggested';

export interface LanguageLabels {
  prompt: string;
  switchTo: string;
  dismiss: string;
}

export const LANGUAGE_LABELS: Record<string, LanguageLabels> = {
  ru: {
    prompt: 'Эта страница есть на русском',
    switchTo: 'Русский',
    dismiss: 'Закрыть',
  },
  en: {
    prompt: 'This page is available in English',
    switchTo: 'English',
    dismiss: 'Dismiss',
  },
  sr: {
    prompt: 'Ova stranica postoji i na srpskom',
    switchTo: 'Srpski',
    dismiss: 'Zatvori',
  },
  es: {
    prompt: 'Esta página está disponible en español',
    switchTo: 'Español',
    dismiss: 'Cerrar',
  },
  de: {
    prompt: 'Diese Seite gibt es auch auf Deutsch',
    switchTo: 'Deutsch',
    dismiss: 'Schließen',
  },
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

export function silenceLanguageSuggestion(): void {
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
        const prompt = this.querySelector<HTMLElement>('[data-lang-prompt]');
        const close = this.querySelector<HTMLElement>('[data-lang-dismiss]');
        if (!link || !prompt || dismissed()) return;

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
        prompt.textContent = labels.prompt;
        prompt.lang = offer;
        this.setAttribute('aria-label', labels.prompt);
        close?.setAttribute('aria-label', labels.dismiss);
        this.hidden = false;

        const from = subtag(this.ownerDocument.documentElement.lang);
        const to = subtag(offer);
        const suggested = [
          ...this.ownerDocument.querySelectorAll(
            `[${LOCALE_CHOICE_ATTRIBUTE}]`,
          ),
        ].filter(
          (option) =>
            subtag(option.getAttribute(LOCALE_CHOICE_ATTRIBUTE)!) === to,
        );
        suggested.forEach((option) =>
          option.setAttribute(LANGUAGE_SUGGESTED_ATTRIBUTE, ''),
        );
        reachGoal(GOALS.langOfferShown, { from, to });

        const dismiss = () => {
          silenceLanguageSuggestion();
          reachGoal(GOALS.langOfferDismissed, { from, to });
          suggested.forEach((option) =>
            option.removeAttribute(LANGUAGE_SUGGESTED_ATTRIBUTE),
          );
          this.hidden = true;
        };

        this.addEventListener(
          'keydown',
          (event) => {
            if (event.key === 'Escape') dismiss();
          },
          { signal },
        );

        this.addEventListener(
          'click',
          (event) => {
            const target = event.target as Element | null;
            if (target?.closest('[data-lang-link]')) {
              silenceLanguageSuggestion();
              reachGoal(GOALS.langOfferTaken, { from, to });
              return;
            }
            if (target?.closest('[data-lang-dismiss]')) dismiss();
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
