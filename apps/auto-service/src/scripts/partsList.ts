import * as z from 'zod/mini';
import { fitComment } from '@podbor/catalog-contract/comment';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import { vinFrom } from '@/utils/carFacts';
import { formatMoney } from '@/utils/money';
import {
  forgetStored,
  readStoredJson,
  writeStoredJson,
  type ValueStorage as ListStorage,
} from '@podbor/site-kit/stored-value';
import {
  LEAD_FORM_RESULT_EVENT,
  type LeadFormResult,
} from '@podbor/lead-crm/submit';
import { PARTS_LIST_CHANGED_EVENT, PARTS_LIST_STORAGE_KEY } from './cartBadge';

const announceChange = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PARTS_LIST_CHANGED_EVENT));
  }
};

export const listedPartSchema = z.object({
  slug: z.string(),
  brand: z.string(),
  number: z.string(),
  name: z.string(),
  car: z.optional(z.string()),
  vin: z.optional(z.string()),
  quantity: z.optional(z.coerce.number()),
  addon: z.optional(z.string()),
  addon_translations: z.optional(
    z.record(z.string(), z.record(z.string(), z.string())),
  ),
  addon_price: z.optional(z.coerce.number()),
  with_addon: z.optional(z.boolean()),
});

export type ListedPart = z.infer<typeof listedPartSchema>;

type AddonTranslations = ListedPart['addon_translations'] | null;

export const addonLabel = (
  label: string,
  translations: AddonTranslations,
  locale: string,
): string => translations?.[locale]?.label || label;

const parsedJson = (text: string | undefined): unknown => {
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
};

export const listedPartFromDataset = (
  { addonTranslations, addonPrice, ...dataset }: DOMStringMap,
  extra: Partial<ListedPart> = {},
): ListedPart | null => {
  const translations = parsedJson(addonTranslations);
  const parsed = listedPartSchema.safeParse({
    ...dataset,
    ...(translations !== undefined && { addon_translations: translations }),
    ...(addonPrice && { addon_price: addonPrice }),
    ...extra,
  });
  return parsed.success ? parsed.data : null;
};

const partsListSchema = z.array(listedPartSchema);

export const readPartsList = (storage?: ListStorage): ListedPart[] =>
  readStoredJson(PARTS_LIST_STORAGE_KEY, partsListSchema, [], storage);

function writePartsList(parts: ListedPart[], storage?: ListStorage): void {
  writeStoredJson(PARTS_LIST_STORAGE_KEY, parts, storage);
  announceChange();
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

function updatePart(
  slug: string,
  change: Partial<ListedPart>,
  storage?: ListStorage,
): void {
  writeStoredJson(
    PARTS_LIST_STORAGE_KEY,
    readPartsList(storage).map((part) =>
      part.slug === slug ? { ...part, ...change } : part,
    ),
    storage,
  );
}

export const setPartAddon = (
  slug: string,
  on: boolean,
  storage?: ListStorage,
): void => updatePart(slug, { with_addon: on }, storage);

export const MAX_PART_QUANTITY = 99;

export const wantedQuantity = (value: number): number =>
  Number.isFinite(value)
    ? Math.min(MAX_PART_QUANTITY, Math.max(1, Math.floor(value)))
    : 1;

export const setPartQuantity = (
  slug: string,
  quantity: number,
  storage?: ListStorage,
): void => updatePart(slug, { quantity: wantedQuantity(quantity) }, storage);

export function clearPartsList(storage?: ListStorage): void {
  forgetStored(PARTS_LIST_STORAGE_KEY, storage);
  announceChange();
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
    readPartsList(storage).map(({ car: _car, vin: _vin, ...part }) => part),
    storage,
  );
}

const partTitle = ({ brand, number, name }: ListedPart): string =>
  `${brand} ${number}, ${name}`;

export const partLine = (part: ListedPart): string => {
  const { quantity = 1 } = part;
  return `${partTitle(part)}${quantity > 1 ? ` × ${quantity}` : ''}`;
};

const carNote = ({ car, vin }: ListedPart): string =>
  vin ? `${car}, VIN ${vin}` : String(car);

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
    lines: parts.map((part) => {
      const line =
        !shared && part.car
          ? `${partLine(part)} (${carNote(part)})`
          : partLine(part);
      return part.addon && part.with_addon ? `${line}\n+ ${part.addon}` : line;
    }),
    note,
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
          const part = listedPartFromDataset(this.dataset);
          if (part) addToPartsList(part);
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
            const part = listedPartFromDataset(item.dataset, {
              car: this.dataset.car,
              ...(vin && { vin }),
            });
            if (part) addToPartsList(part);
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

        const itemFor = (part: ListedPart) => {
          const item = template.content.cloneNode(true) as DocumentFragment;
          const link =
            item.querySelector<HTMLAnchorElement>('[data-part-link]');
          const remove = item.querySelector('[data-part-remove]');
          if (link) {
            link.textContent = partTitle(part);
            link.href = (this.dataset.partHref ?? '').replace(
              '{slug}',
              part.slug,
            );
          }
          for (const control of item.querySelectorAll(
            '[data-part-remove], [data-part-quantity]',
          )) {
            control.setAttribute(
              'aria-label',
              `${control.getAttribute('aria-label') ?? ''}: ${partTitle(part)}`,
            );
          }
          remove?.addEventListener('click', () =>
            removeFromPartsList(part.slug),
          );
          const quantity = item.querySelector<HTMLInputElement>(
            '[data-part-quantity]',
          );
          if (quantity) {
            quantity.value = String(part.quantity ?? 1);
            quantity.addEventListener('change', () => {
              const wanted = wantedQuantity(quantity.valueAsNumber);
              quantity.value = String(wanted);
              setPartQuantity(part.slug, wanted);
            });
          }
          const addon = item.querySelector<HTMLElement>('[data-part-addon]');
          const toggle = addon?.querySelector<HTMLInputElement>(
            '[data-part-addon-toggle]',
          );
          if (addon && toggle && part.addon) {
            const {
              addonTemplate = '{service}',
              locale = '',
              localeTag = 'sr',
            } = this.dataset;
            addon.hidden = false;
            addon.querySelector('[data-part-addon-label]')!.textContent =
              addonTemplate.replace(
                '{service}',
                addonLabel(part.addon, part.addon_translations, locale),
              );
            addon.querySelector('[data-part-addon-price]')!.textContent =
              part.addon_price === undefined
                ? ''
                : `+${formatMoney(part.addon_price, 'RSD', localeTag)}`;
            toggle.checked = Boolean(part.with_addon);
            toggle.addEventListener('change', () =>
              setPartAddon(part.slug, toggle.checked),
            );
          }
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
          list.replaceChildren(...parts.map(itemFor));
        };
        render();
        window.addEventListener(PARTS_LIST_CHANGED_EVENT, render);
        window.addEventListener('storage', render);
        const listVin = listCar(readPartsList())?.vin;
        if (vinInput && listVin) vinInput.value = listVin;

        carLine
          ?.querySelector('[data-parts-car-remove]')
          ?.addEventListener('click', () => {
            const forgotten = listCar(readPartsList())?.vin;
            if (vinInput && forgotten && vinInput.value.trim() === forgotten) {
              vinInput.value = '';
              vinInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            forgetListCar();
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
