import * as z from 'zod/mini';
import { fitComment } from '@podbor/catalog-contract/comment';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import { vinFrom } from '@/utils/carFacts';
import {
  LEAD_FORM_RESULT_EVENT,
  type LeadFormResult,
} from '@podbor/lead-crm/submit';

export const PARTS_LIST_STORAGE_KEY = 'carlab_parts_list';

export const listedPartSchema = z.object({
  slug: z.string(),
  brand: z.string(),
  number: z.string(),
  name: z.string(),
  car: z.optional(z.string()),
  vin: z.optional(z.string()),
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
  const listed = parts.findIndex(({ slug }) => slug === part.slug);
  writePartsList(
    listed === -1 ? [...parts, part] : parts.with(listed, part),
    storage,
  );
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

export type ListCar = { car: string; vin?: string };

export function listCar(parts: ListedPart[]): ListCar | null {
  const [first] = parts;
  if (!first?.car) return null;
  const shared = parts.every(
    ({ car, vin }) => car === first.car && vin === first.vin,
  );
  if (!shared) return null;
  return first.vin ? { car: first.car, vin: first.vin } : { car: first.car };
}

export function forgetListCar(storage?: ListStorage): void {
  writePartsList(
    readPartsList(storage).map(({ slug, brand, number, name }) => ({
      slug,
      brand,
      number,
      name,
    })),
    storage,
  );
}

export const partLine = ({ brand, number, name }: ListedPart): string =>
  `${brand} ${number}, ${name}`;

export function inquiryComment({
  parts,
  note,
  limit,
  more,
}: {
  parts: ListedPart[];
  note: string;
  limit: number;
  more: (count: number) => string;
}): string {
  const shared = listCar(parts);
  return fitComment({
    head: [shared?.car ?? ''],
    lines: parts.map((part) =>
      !shared && part.car ? `${partLine(part)} (${part.car})` : partLine(part),
    ),
    tail: [note],
    limit,
    more,
  });
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
          const vin = vinFrom(location.search);
          for (const item of this.querySelectorAll<HTMLElement>(
            '[data-slug]:not([hidden])',
          )) {
            const parsed = listedPartSchema.safeParse({
              ...item.dataset,
              car: this.dataset.car,
              ...(vin && { vin }),
            });
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

        const carLine = this.querySelector<HTMLElement>('[data-parts-car]');
        const carName = carLine?.querySelector('[data-parts-car-name]');
        const vinInput = form.querySelector<HTMLInputElement>('[name="vin"]');

        const render = (): void => {
          const parts = readPartsList();
          const shared = listCar(parts);
          block.hidden = parts.length === 0;
          if (carLine && carName) {
            carName.textContent = shared?.car ?? '';
            carLine.hidden = !shared;
          }
          list.replaceChildren(...parts.map((part) => itemFor(part, render)));
        };
        render();
        const listVin = listCar(readPartsList())?.vin;
        if (vinInput && listVin) vinInput.value = listVin;

        carLine
          ?.querySelector('[data-parts-car-remove]')
          ?.addEventListener('click', () => {
            forgetListCar();
            render();
          });

        form.addEventListener('formdata', (event) => {
          const parts = readPartsList();
          if (parts.length === 0) return;
          event.formData.set(
            'comment',
            inquiryComment({
              parts,
              note: String(event.formData.get('comment') ?? ''),
              limit: MAX_COMMENT_LENGTH,
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
