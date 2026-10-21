import * as z from 'zod/mini';
import {
  CART_FINGERPRINT_FIELD,
  cartFingerprint,
} from '@podbor/catalog-contract/fingerprint';
import {
  CART_NOTICE_PARAM,
  ORDER_NUMBER_PARAM,
  ORDERED_CART_PARAM,
} from '@/utils/cartNotice';
import { formatLeadTime, type LeadTimeCopy } from '@/utils/leadTime';
import { formatMoney } from '@/utils/money';
import { CART_CHANGED_EVENT, CART_STORAGE_KEY } from './cartBadge';
import { addToPartsList, listedPartSchema, type ListedPart } from './partsList';

export { CART_STORAGE_KEY };

const storedCartSchema = z.object({
  id: z.string(),
  parts: z.array(listedPartSchema),
  count: z.optional(z.number()),
  prices: z.optional(z.record(z.string(), z.number())),
});

export type StoredCart = z.infer<typeof storedCartSchema>;

const offerSchema = z.object({
  id: z.string(),
  price: z.number(),
  currency: z.string(),
  stock_quantity: z.number(),
  lead_time_days: z.number(),
});

type PartOffer = z.infer<typeof offerSchema>;

const inquirySchema = z.object({ kind: z.literal('inquiry') });

const offersOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('offers'), offers: z.array(offerSchema) }),
  inquirySchema,
]);

const offerCartSchema = z.object({
  id: z.string(),
  currency: z.string(),
  total: z.number(),
  items: z.array(
    z.object({
      id: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      available: z.boolean(),
      part: listedPartSchema,
    }),
  ),
});

type OfferCart = z.infer<typeof offerCartSchema>;
type CartLine = OfferCart['items'][number];

const cartOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cart'), cart: offerCartSchema }),
  z.object({ kind: z.literal('empty') }),
  z.object({
    kind: z.literal('refused'),
    code: z.string(),
    cartId: z.nullable(z.string()),
  }),
  inquirySchema,
]);

type CartOutcome = z.infer<typeof cartOutcomeSchema>;

type CartStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const orBrowser = (storage?: CartStorage): CartStorage =>
  storage ?? localStorage;

const announceCartChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));
  }
};

export function readCart(storage?: CartStorage): StoredCart | null {
  try {
    const parsed = storedCartSchema.safeParse(
      JSON.parse(orBrowser(storage).getItem(CART_STORAGE_KEY) ?? 'null'),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCart(stored: StoredCart, storage?: CartStorage): void {
  try {
    orBrowser(storage).setItem(CART_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    return;
  }
  announceCartChange();
}

export function rememberCart(cart: OfferCart, storage?: CartStorage): void {
  writeCart(
    {
      id: cart.id,
      parts: cart.items.map(({ part }) => part),
      count: cart.items.reduce((sum, { quantity }) => sum + quantity, 0),
      prices: Object.fromEntries(
        cart.items.map(({ id, unit_price }) => [id, unit_price]),
      ),
    },
    storage,
  );
}

function keepCartId(id: string | null, storage?: CartStorage): void {
  const stored = readCart(storage);
  if (id && stored?.id !== id) {
    writeCart({ id, parts: [], count: 0 }, storage);
  }
}

export function forgetCart(storage?: CartStorage): void {
  try {
    orBrowser(storage).removeItem(CART_STORAGE_KEY);
  } catch {
    return;
  }
  announceCartChange();
}

export function forgetOrderedCart(
  orderedId: string | null,
  storage?: CartStorage,
): void {
  if (orderedId && readCart(storage)?.id === orderedId) forgetCart(storage);
}

export const unavailableNames = (cart: OfferCart): string[] =>
  cart.items.filter(({ available }) => !available).map(({ part }) => part.name);

export function moveCartToInquiry(storage?: CartStorage): void {
  for (const part of readCart(storage)?.parts ?? []) {
    addToPartsList(part, storage);
  }
  forgetCart(storage);
}

export const repricedSince = (seen: StoredCart, cart: OfferCart): boolean =>
  cart.items.some(({ id, unit_price }) => {
    const before = seen.prices?.[id];
    return before !== undefined && before !== unit_price;
  });

export const payableTotal = (cart: OfferCart): number =>
  cart.items
    .filter(({ available }) => available)
    .reduce((sum, line) => sum + line.unit_price * line.quantity, 0);

const CHECKOUT_MEMORY_KEY = 'carlab_checkout_form';
const REMEMBERED_FIELDS = [
  '[data-country]',
  '[data-phone]',
  '[data-telegram]',
  '[name="name"]',
  '[name="vin"]',
  '[name="comment"]',
] as const;

type FormStorage = Pick<Storage, 'getItem' | 'setItem'>;

const fieldIn = (form: HTMLFormElement, selector: string) =>
  form.querySelector<HTMLInputElement | HTMLSelectElement>(selector);

export function rememberCheckout(
  form: HTMLFormElement,
  storage: FormStorage = sessionStorage,
): void {
  const values = Object.fromEntries(
    REMEMBERED_FIELDS.map((selector) => [
      selector,
      fieldIn(form, selector)?.value ?? '',
    ]),
  );
  const channel =
    form.querySelector<HTMLInputElement>('[name="contact_channel"]')?.value ??
    '';
  try {
    storage.setItem(CHECKOUT_MEMORY_KEY, JSON.stringify({ values, channel }));
  } catch {
    return;
  }
}

const checkoutMemorySchema = z.object({
  values: z.record(z.string(), z.string()),
  channel: z.string(),
});

export function restoreCheckout(
  form: HTMLFormElement,
  storage: FormStorage = sessionStorage,
): void {
  let memory: z.infer<typeof checkoutMemorySchema>;
  try {
    const parsed = checkoutMemorySchema.safeParse(
      JSON.parse(storage.getItem(CHECKOUT_MEMORY_KEY) ?? 'null'),
    );
    if (!parsed.success) return;
    memory = parsed.data;
  } catch {
    return;
  }
  if (memory.channel) {
    form
      .querySelector<HTMLElement>(`[data-tab="${CSS.escape(memory.channel)}"]`)
      ?.click();
  }
  for (const [selector, value] of Object.entries(memory.values)) {
    const field = fieldIn(form, selector);
    if (field && value) {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

const getJson = async <T>(
  schema: z.ZodMiniType<T>,
  url: string,
  init?: RequestInit,
): Promise<T | null> => {
  try {
    const response = await fetch(url, init);
    if (!response.ok) return null;
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const sendJson = (method: string, body: unknown) =>
  getJson(cartOutcomeSchema, '/api/cart', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const fill = (root: ParentNode, selector: string, text: string | null) => {
  const node = root.querySelector<HTMLElement>(selector);
  if (!node) return;
  node.textContent = text ?? '';
  node.hidden = text === null;
};

const busy = (button: HTMLElement, on: boolean) => {
  if (on) {
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-disabled', 'true');
  } else {
    button.removeAttribute('aria-busy');
    button.removeAttribute('aria-disabled');
  }
};

const isBusy = (button: HTMLElement) =>
  button.getAttribute('aria-busy') === 'true';

const showOnly = (root: ParentNode, attribute: string, value: string) => {
  for (const block of root.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    block.hidden = block.getAttribute(attribute) !== value;
  }
};

export function definePartOffers(tagName = 'part-offers'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        this.addEventListener('click', (event) => {
          const target = event.target as Element;
          const buy = target.closest<HTMLButtonElement>('[data-buy]');
          if (buy) void this.buy(buy);
          if (target.closest('[data-ask]')) this.addToInquiry();
        });
        void this.refresh();
      }

      listedPart(): ListedPart | null {
        const part = listedPartSchema.safeParse({ ...this.dataset });
        return part.success ? part.data : null;
      }

      addToInquiry(): void {
        const part = this.listedPart();
        if (part) addToPartsList(part);
      }

      async refresh(): Promise<void> {
        const outcome = await getJson(
          offersOutcomeSchema,
          `/api/part-offers?id=${encodeURIComponent(this.dataset.id ?? '')}`,
        );
        if (outcome?.kind !== 'offers' || outcome.offers.length === 0) return;
        this.querySelector('[data-offers]')?.replaceChildren(
          ...outcome.offers.map((offer) => this.row(offer)),
        );
      }

      row(offer: PartOffer): Node {
        const {
          localeTag = 'sr',
          stockLabel = '',
          leadLabel = '',
          inStock = '',
          days = '{}',
        } = this.dataset;
        const template = this.querySelector<HTMLTemplateElement>(
          'template[data-offer]',
        )!;
        const row = template.content.cloneNode(true) as DocumentFragment;
        const inStockNow = offer.stock_quantity > 0;
        fill(
          row,
          '[data-price]',
          formatMoney(offer.price, offer.currency, localeTag),
        );
        fill(
          row,
          '[data-stock]',
          inStockNow ? `${stockLabel}: ${offer.stock_quantity}` : null,
        );
        fill(
          row,
          '[data-lead]',
          offer.lead_time_days > 0
            ? `${leadLabel}: ${formatLeadTime(
                offer.lead_time_days,
                { inStock, days: JSON.parse(days) as LeadTimeCopy['days'] },
                localeTag,
              )}`
            : null,
        );
        row.querySelector<HTMLElement>('[data-out]')!.hidden = inStockNow;
        row.querySelector<HTMLElement>('[data-ask]')!.hidden = inStockNow;
        const buy = row.querySelector<HTMLButtonElement>('[data-buy]')!;
        buy.hidden = !inStockNow;
        buy.setAttribute('data-offer-id', offer.id);
        return row;
      }

      linkToCart(button: HTMLButtonElement): void {
        const link = document.createElement('a');
        link.href = this.dataset.cartHref ?? '';
        link.className = button.className.replace(
          'btn-primary',
          'btn-secondary',
        );
        link.append(...button.childNodes);
        const label = link.querySelector('[data-label]');
        if (label) label.textContent = this.dataset.addedLabel ?? '';
        button.replaceWith(link);
      }

      async buy(button: HTMLButtonElement): Promise<void> {
        if (isBusy(button)) return;
        busy(button, true);
        const outcome = await sendJson('POST', {
          cart_id: readCart()?.id ?? null,
          offer_id: button.dataset.offerId,
        });
        busy(button, false);
        if (outcome?.kind === 'cart') {
          rememberCart(outcome.cart);
          this.linkToCart(button);
          showOnly(this, 'data-status', 'added');
          return;
        }
        if (
          outcome?.kind === 'refused' &&
          outcome.code === 'OFFER_OUT_OF_STOCK'
        ) {
          keepCartId(outcome.cartId);
          showOnly(this, 'data-status', 'stock-limit');
          return;
        }
        if (outcome?.kind === 'refused') keepCartId(outcome.cartId);
        this.addToInquiry();
        showOnly(this, 'data-status', 'inquiry');
      }
    },
  );
}

export function defineOfferCart(tagName = 'offer-cart'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      cart: OfferCart | null = null;

      connectedCallback(): void {
        const params = new URLSearchParams(location.search);
        const notice = params.get(CART_NOTICE_PARAM) ?? '';
        if (notice === 'ordered') {
          forgetOrderedCart(params.get(ORDERED_CART_PARAM));
          this.showOrdered(params.get(ORDER_NUMBER_PARAM));
          return;
        }
        const stored = readCart();
        if (!stored) {
          this.show('empty');
          return;
        }
        const form = this.querySelector('form');
        if (form) {
          if (notice) restoreCheckout(form);
          form.addEventListener('submit', () => rememberCheckout(form));
          form.addEventListener('formdata', (event) => {
            if (!this.cart) return;
            event.formData.set('cart_id', this.cart.id);
            event.formData.set(
              CART_FINGERPRINT_FIELD,
              cartFingerprint(this.cart.items),
            );
          });
        }
        void getJson(
          cartOutcomeSchema,
          `/api/cart?id=${encodeURIComponent(stored.id)}`,
        ).then((outcome) => this.render(outcome, notice));
      }

      show(state: string): void {
        showOnly(this, 'data-state', state);
      }

      showOrdered(orderNumber: string | null): void {
        const {
          orderedHeading,
          orderedLead,
          orderTemplate = '',
        } = this.dataset;
        const heading = document.querySelector('[data-hero-heading]');
        const lead = document.querySelector<HTMLElement>('[data-hero-lead]');
        if (heading && orderedHeading) heading.textContent = orderedHeading;
        if (lead && orderedLead) lead.textContent = orderedLead;
        fill(
          this,
          '[data-order-number]',
          orderNumber && /^\d+$/.test(orderNumber)
            ? orderTemplate.replace('{number}', orderNumber)
            : null,
        );
        this.show('ordered');
      }

      render(outcome: CartOutcome | null, notice = ''): void {
        if (outcome?.kind === 'refused' && this.cart) {
          this.render({ kind: 'cart', cart: this.cart }, 'stock-limit');
          return;
        }
        if (!outcome || outcome.kind !== 'cart') {
          if (outcome?.kind === 'empty') {
            forgetCart();
            showOnly(this, 'data-empty-notice', notice);
            this.show('empty');
          } else {
            moveCartToInquiry();
            this.show('fallback');
          }
          return;
        }
        const { cart } = outcome;
        const seen = readCart();
        const repriced = seen !== null && repricedSince(seen, cart);
        this.cart = cart;
        rememberCart(cart);
        const { localeTag = 'sr' } = this.dataset;
        this.querySelector('[data-lines]')?.replaceChildren(
          ...cart.items.map((line) => this.line(line, cart, localeTag)),
        );
        fill(
          this,
          '[data-total]',
          formatMoney(payableTotal(cart), cart.currency, localeTag),
        );
        showOnly(this, 'data-notice', notice || (repriced ? 'repriced' : ''));
        this.block(unavailableNames(cart));
        this.show('cart');
      }

      block(names: string[]): void {
        const submit = this.querySelector<HTMLButtonElement>(
          'form [type="submit"]',
        );
        if (submit) submit.disabled = names.length > 0;
        const { blockedTemplate = '{names}' } = this.dataset;
        fill(
          this,
          '[data-blocked]',
          names.length
            ? blockedTemplate.replace('{names}', names.join(', '))
            : null,
        );
      }

      async change(method: string, body: Record<string, unknown>) {
        this.render(await sendJson(method, body));
      }

      line(line: CartLine, cart: OfferCart, localeTag: string): Node {
        const { partHref = '', unitTemplate = '{price}' } = this.dataset;
        const template = this.querySelector<HTMLTemplateElement>(
          'template[data-line]',
        )!;
        const row = template.content.cloneNode(true) as DocumentFragment;
        const money = (amount: number) =>
          formatMoney(amount, cart.currency, localeTag);
        const link = row.querySelector<HTMLAnchorElement>('[data-part-link]');
        if (link) {
          link.textContent = line.part.name;
          link.href = partHref.replace('{slug}', line.part.slug);
        }
        fill(row, '[data-number]', `${line.part.brand} ${line.part.number}`);
        fill(row, '[data-quantity]', String(line.quantity));
        fill(
          row,
          '[data-unit]',
          unitTemplate.replace('{price}', money(line.unit_price)),
        );
        fill(row, '[data-price]', money(line.unit_price * line.quantity));
        row
          .querySelector<HTMLElement>('[data-price]')!
          .classList.toggle('line-through', !line.available);
        row.querySelector<HTMLElement>('[data-unavailable]')!.hidden =
          line.available;
        const name = (button: HTMLElement | null) =>
          button?.setAttribute(
            'aria-label',
            `${button.getAttribute('aria-label') ?? ''}: ${line.part.name}`,
          );
        const lineBody = { cart_id: cart.id, item_id: line.id };
        const act = (selector: string, action: () => Promise<void> | void) => {
          const button = row.querySelector<HTMLButtonElement>(selector);
          name(button);
          button?.addEventListener('click', () => {
            if (button.disabled || isBusy(button)) return;
            busy(button, true);
            void action();
          });
          return button;
        };
        act('[data-remove]', () => this.change('DELETE', lineBody));
        act('[data-increase]', () =>
          this.change('PATCH', { ...lineBody, quantity: line.quantity + 1 }),
        );
        const decrease = act('[data-decrease]', () =>
          this.change('PATCH', { ...lineBody, quantity: line.quantity - 1 }),
        );
        if (decrease) decrease.disabled = line.quantity <= 1;
        const toInquiry = act('[data-to-inquiry]', () => {
          addToPartsList(line.part);
          return this.change('DELETE', lineBody).then(() =>
            showOnly(this, 'data-notice', 'moved'),
          );
        });
        if (toInquiry) toInquiry.hidden = line.available;
        return row;
      }
    },
  );
}
