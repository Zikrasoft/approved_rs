import { VIN_PATTERN } from '@podbor/catalog-contract/vin';
import { GOALS, reachGoal } from '@podbor/site-kit/browser';

export const SUGGEST_DELAY_MS = 200;
const MIN_QUERY_LENGTH = 2;

const compact = (text: string) => text.replace(/[\s.-]/g, '').toUpperCase();

type Link = { href: string; label: string; detail?: string };
type PartLink = Link & { thumb: string | null };
type Suggestions = { vin: boolean; cars: Link[]; parts: PartLink[] };
type Group = 'cars' | 'parts' | 'vin';

const ACTIVE_CLASS = 'bg-shade';

let instances = 0;

export function defineCatalogueSearch(tagName = 'catalogue-search'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      #timer: ReturnType<typeof setTimeout> | undefined;
      #request: AbortController | undefined;
      #active = -1;
      #prefix = `catalogue-search-${++instances}`;

      connectedCallback(): void {
        const form = this.querySelector('form');
        const input = form?.querySelector<HTMLInputElement>('input[name="q"]');
        const panel = this.querySelector<HTMLElement>('[data-suggestions]');
        if (!form || !input || !panel) return;
        panel.id ||= `${this.#prefix}-list`;
        panel.setAttribute('role', 'listbox');
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', panel.id);
        input.setAttribute('aria-expanded', 'false');

        const close = () => {
          this.#request?.abort();
          clearTimeout(this.#timer);
          panel.hidden = true;
          input.setAttribute('aria-expanded', 'false');
          input.removeAttribute('aria-activedescendant');
          this.#active = -1;
        };
        const options = () => [
          ...panel.querySelectorAll<HTMLAnchorElement>('[role="option"]'),
        ];
        const highlight = (index: number) => {
          const all = options();
          this.#active = all.length ? (index + all.length) % all.length : -1;
          all.forEach((option, at) => {
            const on = at === this.#active;
            option.setAttribute('aria-selected', String(on));
            option.classList.toggle(ACTIVE_CLASS, on);
            if (on) {
              input.setAttribute('aria-activedescendant', option.id);
              option.scrollIntoView?.({ block: 'nearest' });
            }
          });
        };

        const option = (link: Link | PartLink, group: Group, index: number) => {
          const anchor = document.createElement('a');
          anchor.id = `${this.#prefix}-${group}-${index}`;
          anchor.href = link.href;
          anchor.setAttribute('role', 'option');
          anchor.setAttribute('aria-selected', 'false');
          anchor.dataset.group = group;
          anchor.className =
            'flex min-h-11 items-center gap-3 rounded-field px-3 py-2 text-sm text-ink transition-colors hover:bg-shade motion-reduce:transition-none';
          if ('thumb' in link) {
            const thumb = document.createElement(link.thumb ? 'img' : 'span');
            thumb.className =
              'size-9 shrink-0 rounded-md border border-line bg-paper object-contain';
            if (thumb instanceof HTMLImageElement && link.thumb) {
              thumb.src = link.thumb;
              thumb.alt = '';
              thumb.loading = 'lazy';
            }
            thumb.setAttribute('aria-hidden', 'true');
            anchor.append(thumb);
          }
          const text = document.createElement('span');
          text.className = 'flex min-w-0 flex-col';
          const label = document.createElement('span');
          label.className =
            group === 'parts' ? 'spec truncate font-semibold' : 'font-semibold';
          label.textContent = link.label;
          text.append(label);
          if (link.detail) {
            const detail = document.createElement('span');
            detail.className = 'truncate text-xs text-muted';
            detail.textContent = ` ${link.detail}`;
            text.append(detail);
          }
          anchor.append(text);
          return anchor;
        };

        const group = (name: Group, label: string, links: Link[]) => {
          const box = document.createElement('div');
          box.setAttribute('role', 'group');
          box.setAttribute('aria-label', label);
          box.className = 'flex flex-col gap-0.5 py-1';
          const heading = document.createElement('span');
          heading.setAttribute('aria-hidden', 'true');
          heading.className =
            'px-3 pt-1 pb-0.5 text-xs font-semibold text-muted';
          heading.textContent = label;
          box.append(
            heading,
            ...links.map((link, at) => option(link, name, at)),
          );
          return box;
        };

        const show = (q: string, found: Suggestions) => {
          const groups = found.vin
            ? [
                group('vin', this.dataset.vinLabel ?? '', [
                  {
                    href: `${form.getAttribute('action')}?${new URLSearchParams({ q })}`,
                    label: this.dataset.vinLabel ?? '',
                    detail: q,
                  },
                ]),
              ]
            : [
                ...(found.cars.length
                  ? [group('cars', this.dataset.carsLabel ?? '', found.cars)]
                  : []),
                ...(found.parts.length
                  ? [group('parts', this.dataset.partsLabel ?? '', found.parts)]
                  : []),
              ];
          panel.replaceChildren(...groups);
          this.#active = -1;
          input.removeAttribute('aria-activedescendant');
          panel.hidden = groups.length === 0;
          input.setAttribute('aria-expanded', String(!panel.hidden));
        };

        const suggest = async () => {
          const q = input.value.trim();
          if (compact(q).length < MIN_QUERY_LENGTH) {
            close();
            return;
          }
          this.#request?.abort();
          const request = new AbortController();
          this.#request = request;
          const params = new URLSearchParams({
            q,
            locale: this.dataset.locale ?? '',
          });
          try {
            const response = await fetch(`${this.dataset.endpoint}?${params}`, {
              signal: request.signal,
            });
            if (!response.ok) throw new Error(String(response.status));
            show(q, (await response.json()) as Suggestions);
          } catch {
            if (!request.signal.aborted) close();
          }
        };
        const later = () => {
          clearTimeout(this.#timer);
          this.#timer = setTimeout(suggest, SUGGEST_DELAY_MS);
        };

        input.addEventListener('input', later);
        input.addEventListener('focus', () => {
          if (panel.childElementCount && panel.hidden) later();
        });
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            close();
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (panel.hidden) return;
            event.preventDefault();
            highlight(
              this.#active === -1 && event.key === 'ArrowUp'
                ? -1
                : this.#active + (event.key === 'ArrowDown' ? 1 : -1),
            );
          } else if (
            event.key === 'Enter' &&
            !panel.hidden &&
            this.#active >= 0
          ) {
            event.preventDefault();
            options()[this.#active]?.click();
          }
        });
        panel.addEventListener('pointerdown', (event) => {
          event.preventDefault();
        });
        panel.addEventListener('click', (event) => {
          const picked = (event.target as Element).closest<HTMLElement>(
            '[role="option"]',
          );
          if (picked) {
            reachGoal(GOALS.searchSuggestionPick, {
              group: picked.dataset.group,
            });
          }
        });
        this.addEventListener('focusout', (event) => {
          if (!this.contains(event.relatedTarget as Node | null)) close();
        });
        form.addEventListener('submit', () => {
          reachGoal(GOALS.search, {
            kind: VIN_PATTERN.test(compact(input.value)) ? 'vin' : 'query',
          });
        });

        if (document.activeElement === input && input.value.trim()) later();
      }
    },
  );
}
