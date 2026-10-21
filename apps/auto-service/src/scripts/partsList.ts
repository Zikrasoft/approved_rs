import * as z from 'zod/mini';
import {
  LEAD_FORM_RESULT_EVENT,
  type LeadFormResult,
} from '@podbor/lead-crm/submit';

export const PARTS_LIST_STORAGE_KEY = 'carlab_parts_list';

// TODO: mirrors MAX_COMMENT_LENGTH in @podbor/lead-crm/src/form.ts, which the package does not export
export const INQUIRY_COMMENT_LIMIT = 2000;

export const listedPartSchema = z.object({
  slug: z.string(),
  brand: z.string(),
  number: z.string(),
  name: z.string(),
});

export type ListedPart = z.infer<typeof listedPartSchema>;

type ListStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const orBrowser = (storage?: ListStorage): ListStorage =>
  storage ?? localStorage;

export function readPartsList(storage?: ListStorage): ListedPart[] {
  try {
    const parsed = z
      .array(listedPartSchema)
      .safeParse(
        JSON.parse(orBrowser(storage).getItem(PARTS_LIST_STORAGE_KEY) ?? '[]'),
      );
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function writePartsList(parts: ListedPart[], storage?: ListStorage): void {
  try {
    orBrowser(storage).setItem(PARTS_LIST_STORAGE_KEY, JSON.stringify(parts));
  } catch {
    return;
  }
}

export function addToPartsList(part: ListedPart, storage?: ListStorage): void {
  const parts = readPartsList(storage);
  if (parts.some(({ slug }) => slug === part.slug)) return;
  writePartsList([...parts, part], storage);
}

export function removeFromPartsList(slug: string, storage?: ListStorage): void {
  writePartsList(
    readPartsList(storage).filter((part) => part.slug !== slug),
    storage,
  );
}

export function clearPartsList(storage?: ListStorage): void {
  try {
    orBrowser(storage).removeItem(PARTS_LIST_STORAGE_KEY);
  } catch {
    return;
  }
}

export const partLine = ({ brand, number, name }: ListedPart): string =>
  `${brand} ${number}, ${name}`;

export function inquiryComment({
  car,
  parts,
  note,
  limit,
  more,
}: {
  car: string;
  parts: ListedPart[];
  note: string;
  limit: number;
  more: (count: number) => string;
}): string {
  const head = [car.trim()].filter(Boolean);
  const tail = [note.trim()].filter(Boolean);
  const compose = (lines: string[], leftOut: number) =>
    [...head, ...lines, ...(leftOut > 0 ? [more(leftOut)] : []), ...tail].join(
      '\n',
    );

  const lines = parts.map(partLine);
  let kept = lines.length;
  while (
    kept > 0 &&
    compose(lines.slice(0, kept), lines.length - kept).length > limit
  ) {
    kept -= 1;
  }
  return compose(lines.slice(0, kept), lines.length - kept).slice(0, limit);
}

export function definePartsListAdd(tagName = 'parts-list-add'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        this.addEventListener('click', () => {
          const parsed = listedPartSchema.safeParse({ ...this.dataset });
          if (parsed.success) addToPartsList(parsed.data);
        });
      }
    },
  );
}

export function definePartsListAddAll(tagName = 'parts-list-add-all'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        this.querySelector('[data-add-all]')?.addEventListener('click', () => {
          for (const item of this.querySelectorAll<HTMLElement>(
            '[data-slug]:not([hidden])',
          )) {
            const parsed = listedPartSchema.safeParse({ ...item.dataset });
            if (parsed.success) addToPartsList(parsed.data);
          }
        });
      }
    },
  );
}

export function definePartsInquiry(tagName = 'parts-inquiry'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const form = this.querySelector('form');
        const block = this.querySelector<HTMLElement>(
          '[data-parts-list-block]',
        );
        const list = this.querySelector('[data-parts-list]');
        const template = this.querySelector<HTMLTemplateElement>(
          'template[data-parts-item]',
        );
        if (!form || !block || !list || !template) return;

        const itemFor = (part: ListedPart, rerender: () => void) => {
          const item = template.content.cloneNode(true) as DocumentFragment;
          const link =
            item.querySelector<HTMLAnchorElement>('[data-part-link]');
          const remove = item.querySelector('[data-part-remove]');
          if (link) {
            link.textContent = partLine(part);
            link.href = (this.dataset.partHref ?? '').replace(
              '{slug}',
              part.slug,
            );
          }
          remove?.setAttribute(
            'aria-label',
            `${remove.getAttribute('aria-label') ?? ''}: ${partLine(part)}`,
          );
          remove?.addEventListener('click', () => {
            removeFromPartsList(part.slug);
            rerender();
          });
          return item;
        };

        const render = (): void => {
          const parts = readPartsList();
          block.hidden = parts.length === 0;
          list.replaceChildren(...parts.map((part) => itemFor(part, render)));
        };
        render();

        form.addEventListener('formdata', (event) => {
          const parts = readPartsList();
          if (parts.length === 0) return;
          event.formData.set(
            'comment',
            inquiryComment({
              car: this.dataset.car ?? '',
              parts,
              note: String(event.formData.get('comment') ?? ''),
              limit: INQUIRY_COMMENT_LIMIT,
              more: (count) =>
                (this.dataset.moreTemplate ?? '').replace(
                  '{count}',
                  String(count),
                ),
            }),
          );
        });

        this.addEventListener(LEAD_FORM_RESULT_EVENT, (event) => {
          if ((event as CustomEvent<LeadFormResult>).detail.ok) {
            clearPartsList();
          }
        });
      }
    },
  );
}
