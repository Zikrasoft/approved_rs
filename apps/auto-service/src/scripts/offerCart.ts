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
import { isBuyable } from '@podbor/catalog-contract/availability';
import {
  availabilityText,
  formatLeadTime,
  type AvailabilityCopy,
  type LeadTimeCopy,
} from '@/utils/leadTime';
import { formatMoney } from '@/utils/money';
import type { LineAddonKind } from '@/utils/catalogue';
import { vinFrom } from '@/utils/carFacts';
import {
  forgetStored,
  readStoredJson,
  writeStoredJson,
  type ValueStorage as CartStorage,
} from '@podbor/site-kit/stored-value';
import { CART_CHANGED_EVENT, CART_STORAGE_KEY } from './cartBadge';
import { PRICES_FILLED_EVENT, shopPreview } from './shopPreview';
import {
  addonLabel,
  addToPartsList,
  listedPartFromDataset,
  listedPartSchema,
  type ListedPart,
} from './partsList';

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
      in_stock: z.boolean(),
      lead_time_days: z.number(),
      max_quantity: z.optional(z.nullable(z.number())),
      addon: z.nullable(
        z.object({
          item_id: z.nullable(z.string()),
          label: z.string(),
          translations: z.nullable(
            z.record(z.string(), z.record(z.string(), z.string())),
          ),
          unit_price: z.number(),
        }),
      ),
      installation: z.optional(
        z.nullable(
          z.object({ item_id: z.nullable(z.string()), unit_price: z.number() }),
        ),
      ),
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

const announceCartChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));
  }
};

export const readCart = (storage?: CartStorage): StoredCart | null =>
  readStoredJson(CART_STORAGE_KEY, storedCartSchema, null, storage);

function writeCart(stored: StoredCart, storage?: CartStorage): void {
  if (writeStoredJson(CART_STORAGE_KEY, stored, storage)) announceCartChange();
}

const listedLine = ({ part, quantity, addon }: CartLine): ListedPart => ({
  ...part,
  quantity,
  ...(addon && {
    addon: addon.label,
    ...(addon.translations && { addon_translations: addon.translations }),
    addon_price: addon.unit_price,
    with_addon: addon.item_id !== null,
  }),
});

export function rememberCart(cart: OfferCart, storage?: CartStorage): void {
  writeCart(
    {
      id: cart.id,
      parts: cart.items.map(listedLine),
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
  if (forgetStored(CART_STORAGE_KEY, storage)) announceCartChange();
}

export function forgetOrderedCart(
  orderedId: string | null,
  storage?: CartStorage,
): void {
  if (orderedId && readCart(storage)?.id === orderedId) forgetCart(storage);
}

export const orderedNumber = (
  notice: string,
  number: string | null,
): string | null =>
  notice === 'ordered' && number && /^\d+$/.test(number) ? number : null;

export const unavailableNames = (cart: OfferCart): string[] =>
  cart.items.filter(({ available }) => !available).map(({ part }) => part.name);

export function moveCartToInquiry(storage?: CartStorage): void {
  for (const part of readCart(storage)?.parts ?? []) {
    addToPartsList(part, storage);
  }
  forgetCart(storage);
}

export type CartState = 'cart' | 'gone' | 'refused' | 'unreachable';

export function settleCart(
  outcome: CartOutcome | null,
  storage?: CartStorage,
): CartState {
  switch (outcome?.kind) {
    case 'cart':
      return 'cart';
    case 'refused':
      return 'refused';
    case 'empty':
      forgetCart(storage);
      return 'gone';
    default:
      return 'unreachable';
  }
}

export type PriceChange = { name: string; before: number; after: number };

export const priceChanges = (
  seen: StoredCart,
  cart: OfferCart,
): PriceChange[] =>
  cart.items.flatMap(({ id, unit_price, part }) => {
    const before = seen.prices?.[id];
    return before !== undefined && before !== unit_price
      ? [{ name: part.name, before, after: unit_price }]
      : [];
  });

export function orderSummary(cart: OfferCart) {
  const sold = cart.items.filter(({ available }) => available);
  const count = sold.reduce((sum, { quantity }) => sum + quantity, 0);
  const parts = sold.reduce(
    (sum, { unit_price, quantity }) => sum + unit_price * quantity,
    0,
  );
  const addons = sold.reduce(
    (sum, { addon, installation, quantity }) =>
      sum +
      [addon, installation].reduce(
        (added, extra) =>
          added + (extra?.item_id ? extra.unit_price * quantity : 0),
        0,
      ),
    0,
  );
  return { count, parts, addons, total: parts + addons };
}

const RECEIPT_KEY = 'carlab_order_receipt';

export function rememberReceipt(
  cart: OfferCart,
  storage: CartStorage = sessionStorage,
): void {
  writeStoredJson(RECEIPT_KEY, cart, storage);
}

export function readReceipt(
  cartId: string | null,
  storage: CartStorage = sessionStorage,
): OfferCart | null {
  const receipt = readStoredJson(RECEIPT_KEY, offerCartSchema, null, storage);
  return receipt?.id === cartId ? receipt : null;
}

const CHECKOUT_MEMORY_KEY = 'carlab_checkout_form';
const CONTACT_MEMORY_KEY = 'carlab_checkout_contact';
const REMEMBERED_FIELDS = [
  '[data-country]',
  '[data-phone]',
  '[data-telegram]',
  '[name="name"]',
  '[name="vin"]',
  '[name="comment"]',
  '[data-consent]',
] as const;

const fieldIn = (form: HTMLFormElement, selector: string) =>
  form.querySelector<HTMLInputElement | HTMLSelectElement>(selector);

const fieldValue = (field: HTMLInputElement | HTMLSelectElement | null) =>
  field instanceof HTMLInputElement && field.type === 'checkbox'
    ? field.checked
      ? field.value
      : ''
    : (field?.value ?? '');

const checkoutMemorySchema = z.object({
  values: z.record(z.string(), z.string()),
  channel: z.string(),
});

type CheckoutMemory = z.infer<typeof checkoutMemorySchema>;

const readMemory = (storage: CartStorage, key: string): CheckoutMemory | null =>
  readStoredJson(key, checkoutMemorySchema, null, storage);

const writeMemory = (
  storage: CartStorage,
  key: string,
  memory: CheckoutMemory,
) => writeStoredJson(key, memory, storage);

export function rememberCheckout(
  form: HTMLFormElement,
  storage: CartStorage = sessionStorage,
): void {
  writeMemory(storage, CHECKOUT_MEMORY_KEY, {
    values: Object.fromEntries(
      REMEMBERED_FIELDS.map((selector) => [
        selector,
        fieldValue(fieldIn(form, selector)),
      ]),
    ),
    channel:
      form.querySelector<HTMLInputElement>('[name="contact_channel"]')?.value ??
      '',
  });
}

export function forgetCheckout(
  session: CartStorage = sessionStorage,
  local: CartStorage = localStorage,
): void {
  forgetStored(CHECKOUT_MEMORY_KEY, session);
  forgetStored(CONTACT_MEMORY_KEY, local);
}

export function restoreCheckout(
  form: HTMLFormElement,
  session: CartStorage = sessionStorage,
): void {
  const memory = readMemory(session, CHECKOUT_MEMORY_KEY);
  if (!memory) return;
  if (memory.channel) {
    form
      .querySelector<HTMLElement>(`[data-tab="${CSS.escape(memory.channel)}"]`)
      ?.click();
  }
  for (const [selector, value] of Object.entries(memory.values)) {
    const field = fieldIn(form, selector);
    if (!field || !value) continue;
    if (field instanceof HTMLInputElement && field.type === 'checkbox') {
      field.checked = true;
    } else {
      field.value = value;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const folded = field.closest('details');
    if (folded) folded.open = true;
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

const OFFERS_TIMEOUT_MS = 8000;

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
        if (this.dataset.preview !== undefined && !shopPreview()) return;
        void this.refresh();
      }

      listedPart(): ListedPart | null {
        return listedPartFromDataset(this.dataset);
      }

      addToInquiry(): void {
        const part = this.listedPart();
        if (part) addToPartsList(part);
      }

      async refresh(): Promise<void> {
        this.setAttribute('aria-busy', 'true');
        const outcome = await getJson(
          offersOutcomeSchema,
          `/api/part-offers?id=${encodeURIComponent(this.dataset.id ?? '')}`,
          { signal: AbortSignal.timeout(OFFERS_TIMEOUT_MS) },
        );
        this.removeAttribute('aria-busy');
        if (outcome?.kind !== 'offers' || outcome.offers.length === 0) return;
        this.querySelector('[data-offers]')?.replaceChildren(
          ...outcome.offers.map((offer) => this.row(offer)),
        );
        if (this.hidden) {
          this.hidden = false;
          (this.nextElementSibling as HTMLElement | null)?.setAttribute(
            'hidden',
            '',
          );
        }
      }

      row(offer: PartOffer): Node {
        const {
          localeTag = 'sr',
          stockLabel = '',
          leadLabel = '',
          stockPickup = '',
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
        const leadText =
          offer.lead_time_days > 0
            ? formatLeadTime(
                offer.lead_time_days,
                { inStock, days: JSON.parse(days) as LeadTimeCopy['days'] },
                localeTag,
              )
            : null;
        fill(
          row,
          '[data-stock]',
          inStockNow
            ? leadText
              ? stockPickup.replace('{days}', leadText)
              : stockLabel
            : null,
        );
        fill(
          row,
          '[data-lead]',
          !inStockNow && leadText ? `${leadLabel} ${leadText}` : null,
        );
        row.querySelector<HTMLElement>('[data-out]')!.hidden =
          inStockNow || offer.lead_time_days > 0;
        row.querySelector<HTMLElement>('[data-ask]')!.hidden = isBuyable(offer);
        const buy = row.querySelector<HTMLButtonElement>('[data-buy]')!;
        buy.hidden = !isBuyable(offer);
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

const STEP_SETTLE_MS = 400;

export function stepTarget(
  current: number,
  delta: number,
  cap: number | null,
): { quantity: number; capped: boolean } {
  const wanted = Math.max(1, current + delta);
  return cap !== null && wanted > cap
    ? { quantity: Math.max(1, cap), capped: true }
    : { quantity: wanted, capped: false };
}

export function defineOfferCart(tagName = 'offer-cart'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      cart: OfferCart | null = null;
      targets = new Map<string, number>();
      settle: ReturnType<typeof setTimeout> | undefined;
      queue: Promise<void> = Promise.resolve();

      connectedCallback(): void {
        if (this.dataset.preview !== undefined && !shopPreview()) {
          location.replace(this.dataset.inquiryHref ?? '/');
          return;
        }
        const params = new URLSearchParams(location.search);
        const notice = params.get(CART_NOTICE_PARAM) ?? '';
        const orderedId = params.get(ORDERED_CART_PARAM);
        if (notice === 'ordered') forgetOrderedCart(orderedId);
        const receipt = notice === 'ordered' ? readReceipt(orderedId) : null;
        const orderNumber = orderedNumber(
          notice,
          params.get(ORDER_NUMBER_PARAM),
        );
        if (receipt || orderNumber) {
          forgetCheckout();
          this.showOrdered(orderNumber, receipt);
          return;
        }
        if (notice) {
          const url = new URL(location.href);
          for (const param of [
            CART_NOTICE_PARAM,
            ORDER_NUMBER_PARAM,
            ORDERED_CART_PARAM,
          ]) {
            url.searchParams.delete(param);
          }
          history.replaceState(history.state, '', url);
        }
        const form = this.querySelector('form');
        if (form) {
          void customElements
            .whenDefined('lead-form')
            .then(() => restoreCheckout(form));
          form.addEventListener('change', () => rememberCheckout(form));
          form.addEventListener('submit', () => {
            rememberCheckout(form);
            if (this.cart) rememberReceipt(this.cart);
          });
          this.watchCheckoutBar(form);
          form.addEventListener('formdata', (event) => {
            if (!this.cart) return;
            event.formData.set('cart_id', this.cart.id);
            event.formData.set(
              CART_FINGERPRINT_FIELD,
              cartFingerprint(this.cart.items),
            );
          });
        }
        this.querySelector('[data-retry]')?.addEventListener('click', () =>
          this.load(notice),
        );
        this.querySelector('[data-send-inquiry]')?.addEventListener(
          'click',
          () => {
            moveCartToInquiry();
            location.assign(this.dataset.inquiryHref ?? '');
          },
        );
        this.load(notice);
      }

      load(notice: string): void {
        const stored = readCart();
        if (!stored) {
          showOnly(this, 'data-empty-notice', notice);
          this.show('empty');
          return;
        }
        this.show('loading');
        void getJson(
          cartOutcomeSchema,
          `/api/cart?id=${encodeURIComponent(stored.id)}`,
        ).then((outcome) =>
          this.render(
            outcome,
            notice,
            notice || (stored.parts.length > 0 ? 'expired' : ''),
          ),
        );
      }

      watchCheckoutBar(form: HTMLFormElement): void {
        const bar = this.querySelector<HTMLElement>('[data-checkout-bar]');
        if (!bar) return;
        new IntersectionObserver(([entry]) => {
          bar.hidden =
            entry!.isIntersecting || entry!.boundingClientRect.top < 0;
        }).observe(form);
      }

      show(state: string): void {
        showOnly(this, 'data-state', state);
      }

      showOrdered(orderNumber: string | null, receipt: OfferCart | null): void {
        const { orderedHeading, orderTemplate = '' } = this.dataset;
        const heading = document.querySelector('[data-hero-heading]');
        if (heading && orderedHeading) heading.textContent = orderedHeading;
        fill(
          this,
          '[data-order-number]',
          orderNumber && orderTemplate.replace('{number}', orderNumber),
        );
        if (receipt) this.receipt(receipt);
        this.show('ordered');
      }

      receipt(cart: OfferCart): void {
        const {
          localeTag = 'sr',
          locale = '',
          quantityTemplate = '{count}',
          installationLabel = '',
          installationFree = '',
        } = this.dataset;
        const money = (amount: number) =>
          formatMoney(amount, cart.currency, localeTag);
        const template = this.querySelector<HTMLTemplateElement>(
          'template[data-receipt-line]',
        )!;
        const sold = cart.items.filter(({ available }) => available);
        this.querySelector('[data-receipt-lines]')?.replaceChildren(
          ...sold.map((line) => {
            const { part, quantity, unit_price, addon, installation } = line;
            const row = template.content.cloneNode(true) as DocumentFragment;
            fill(row, '[data-name]', part.name);
            fill(row, '[data-number]', `${part.brand} ${part.number}`);
            fill(row, '[data-ready]', this.readiness(line, localeTag));
            fill(
              row,
              '[data-quantity]',
              quantityTemplate.replace('{count}', String(quantity)),
            );
            fill(row, '[data-price]', money(unit_price * quantity));
            fill(
              row,
              '[data-addon]',
              addon?.item_id
                ? `+ ${addonLabel(addon.label, addon.translations, locale)}, ${money(addon.unit_price * quantity)}`
                : null,
            );
            fill(
              row,
              '[data-installation]',
              installation?.item_id
                ? `+ ${
                    installation.unit_price === 0
                      ? installationFree
                      : `${installationLabel}, ${money(installation.unit_price * quantity)}`
                  }`
                : null,
            );
            return row;
          }),
        );
        const summary = orderSummary(cart);
        fill(this, '[data-receipt-addons]', money(summary.addons));
        fill(this, '[data-receipt-total]', money(summary.total));
        this.querySelector<HTMLElement>('[data-receipt-addon-row]')!.hidden =
          summary.addons === 0;
        this.querySelector<HTMLElement>('[data-ordered-body]')!.hidden = true;
        this.querySelector<HTMLElement>('[data-receipt]')!.hidden = false;
      }

      readiness(line: CartLine, localeTag: string): string | null {
        try {
          return availabilityText(
            line,
            JSON.parse(this.dataset.availability ?? '') as AvailabilityCopy,
            localeTag,
          );
        } catch {
          return null;
        }
      }

      render(outcome: CartOutcome | null, notice = '', goneNotice = ''): void {
        const state = settleCart(outcome);
        if (state === 'gone') {
          this.cart = null;
          this.targets.clear();
          showOnly(this, 'data-empty-notice', goneNotice);
          this.show('empty');
          return;
        }
        if (outcome?.kind === 'cart') {
          this.draw(outcome.cart, notice);
          return;
        }
        this.targets.clear();
        if (this.cart) {
          this.draw(this.cart, state === 'refused' ? 'stock-limit' : 'offline');
          return;
        }
        this.show('fallback');
      }

      draw(cart: OfferCart, notice: string): void {
        const seen = readCart();
        const changes = seen ? priceChanges(seen, cart) : [];
        this.cart = cart;
        rememberCart(cart);
        for (const { id, quantity } of cart.items) {
          if (this.targets.get(id) === quantity) this.targets.delete(id);
        }
        const { localeTag = 'sr' } = this.dataset;
        this.querySelector('[data-lines]')?.replaceChildren(
          ...cart.items.map((line) => this.line(line, cart, localeTag)),
        );
        this.summarize(cart, localeTag);
        showOnly(
          this,
          'data-notice',
          notice || (changes.length ? 'repriced' : ''),
        );
        this.listChanges(changes, cart, localeTag);
        this.block(unavailableNames(cart));
        this.show('cart');
      }

      listChanges(
        changes: PriceChange[],
        cart: OfferCart,
        localeTag: string,
      ): void {
        const list = this.querySelector<HTMLElement>('[data-price-changes]');
        if (!list) return;
        const { template = '' } = list.dataset;
        const money = (amount: number) =>
          formatMoney(amount, cart.currency, localeTag);
        list.replaceChildren(
          ...changes.map(({ name, before, after }) => {
            const item = document.createElement('li');
            item.textContent = template
              .replace('{name}', name)
              .replace('{before}', money(before))
              .replace('{after}', money(after));
            return item;
          }),
        );
        list.hidden = changes.length === 0;
      }

      summarize(cart: OfferCart, localeTag: string): void {
        const { countTemplate = '{count}' } = this.dataset;
        const summary = orderSummary(cart);
        const money = (amount: number) =>
          formatMoney(amount, cart.currency, localeTag);
        for (const node of this.querySelectorAll('[data-total]')) {
          node.textContent = money(summary.total);
        }
        fill(
          this,
          '[data-summary-count]',
          countTemplate.replace('{count}', String(summary.count)),
        );
        fill(this, '[data-summary-parts]', money(summary.parts));
        fill(this, '[data-summary-addons]', money(summary.addons));
        const addons = this.querySelector<HTMLElement>(
          '[data-summary-addon-row]',
        );
        if (addons) addons.hidden = summary.addons === 0;
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

      change(method: string, body: Record<string, unknown>): Promise<void> {
        this.queue = this.queue.then(async () =>
          this.render(await sendJson(method, body)),
        );
        return this.queue;
      }

      step(line: CartLine, delta: number, row: HTMLElement): void {
        const current = this.targets.get(line.id) ?? line.quantity;
        const { quantity: target, capped } = stepTarget(
          current,
          delta,
          line.max_quantity ?? null,
        );
        if (capped) showOnly(this, 'data-notice', 'stock-limit');
        if (target === current) return;
        this.targets.set(line.id, target);
        fill(row, '[data-quantity]', String(target));
        row.setAttribute('aria-busy', 'true');
        clearTimeout(this.settle);
        this.settle = setTimeout(() => {
          for (const [itemId, quantity] of this.targets) {
            void this.change('PATCH', {
              cart_id: this.cart?.id,
              item_id: itemId,
              quantity,
            });
          }
        }, STEP_SETTLE_MS);
      }

      line(line: CartLine, cart: OfferCart, localeTag: string): Node {
        const { partHref = '', unitTemplate = '{price}' } = this.dataset;
        const template = this.querySelector<HTMLTemplateElement>(
          'template[data-line]',
        )!;
        const fragment = template.content.cloneNode(true) as DocumentFragment;
        const row = fragment.firstElementChild as HTMLElement;
        const money = (amount: number) =>
          formatMoney(amount, cart.currency, localeTag);
        const link = row.querySelector<HTMLAnchorElement>('[data-part-link]');
        if (link) {
          link.textContent = line.part.name;
          link.href = partHref.replace('{slug}', line.part.slug);
        }
        fill(row, '[data-number]', `${line.part.brand} ${line.part.number}`);
        const shown = this.targets.get(line.id) ?? line.quantity;
        fill(row, '[data-quantity]', String(shown));
        if (shown !== line.quantity) row.setAttribute('aria-busy', 'true');
        fill(
          row,
          '[data-unit]',
          line.quantity > 1
            ? unitTemplate.replace('{price}', money(line.unit_price))
            : null,
        );
        fill(row, '[data-price]', money(line.unit_price * line.quantity));
        row
          .querySelector<HTMLElement>('[data-price]')!
          .classList.toggle('line-through', !line.available);
        row.querySelector<HTMLElement>('[data-unavailable]')!.hidden =
          line.available;
        fill(
          row,
          '[data-ready]',
          line.available ? this.readiness(line, localeTag) : null,
        );
        const button = (selector: string) => {
          const found = row.querySelector<HTMLButtonElement>(selector);
          found?.setAttribute(
            'aria-label',
            `${found.getAttribute('aria-label') ?? found.textContent?.trim() ?? ''}: ${line.part.name}`,
          );
          return found;
        };
        const lineBody = { cart_id: cart.id, item_id: line.id };
        const act = (selector: string, action: () => Promise<void> | void) => {
          const found = button(selector);
          found?.addEventListener('click', () => {
            if (found.disabled || isBusy(found)) return;
            busy(found, true);
            void action();
          });
          return found;
        };
        act('[data-remove]', () => this.change('DELETE', lineBody));
        const increase = button('[data-increase]');
        const decrease = button('[data-decrease]');
        const stepBy = (delta: number) => {
          this.step(line, delta, row);
          const target = this.targets.get(line.id) ?? line.quantity;
          if (decrease) decrease.disabled = target <= 1;
        };
        increase?.addEventListener('click', () => {
          if (!increase.disabled) stepBy(1);
        });
        decrease?.addEventListener('click', () => {
          if (!decrease.disabled) stepBy(-1);
        });
        if (increase) increase.disabled = !line.available;
        if (decrease) decrease.disabled = shown <= 1;
        const toInquiry = act('[data-to-inquiry]', () => {
          addToPartsList(listedLine(line));
          return this.change('DELETE', lineBody).then(() => {
            showOnly(this, 'data-notice', 'moved');
            showOnly(this, 'data-empty-notice', 'moved');
          });
        });
        if (toInquiry) toInquiry.hidden = line.available;
        const cap = line.max_quantity ?? 0;
        fill(
          row,
          '[data-lower]',
          (this.dataset.lowerTemplate ?? '').replace('{count}', String(cap)),
        );
        const lower = act('[data-lower]', () =>
          this.change('PATCH', { ...lineBody, quantity: cap }),
        );
        if (lower) {
          lower.hidden = line.available || cap < 1 || cap >= line.quantity;
        }
        const { locale = '', installationLabel = '' } = this.dataset;
        const toggles = { money, unitTemplate };
        if (line.addon) {
          this.addon(row, '[data-addon]', line, cart, toggles, {
            ...line.addon,
            label: addonLabel(
              line.addon.label,
              line.addon.translations,
              locale,
            ),
            kind: 'addon',
          });
        }
        if (line.installation) {
          this.addon(row, '[data-installation]', line, cart, toggles, {
            label: installationLabel,
            ...line.installation,
            kind: 'installation',
          });
        }
        return row;
      }

      addon(
        row: HTMLElement,
        selector: string,
        line: CartLine,
        cart: OfferCart,
        {
          money,
          unitTemplate,
        }: { money: (amount: number) => string; unitTemplate: string },
        added: {
          label: string;
          item_id: string | null;
          unit_price: number;
          kind: LineAddonKind;
        },
      ): void {
        const box = row.querySelector<HTMLElement>(selector);
        const toggle = box?.querySelector<HTMLInputElement>(
          '[data-addon-toggle]',
        );
        if (!box || !toggle) return;
        const { addonTemplate = '{service}', freeLabel = '' } = this.dataset;
        const free = added.unit_price === 0;
        box.hidden = !line.available;
        fill(
          box,
          '[data-addon-label]',
          addonTemplate.replace('{service}', added.label),
        );
        fill(
          box,
          '[data-addon-price]',
          free ? freeLabel : `+${money(added.unit_price * line.quantity)}`,
        );
        fill(
          box,
          '[data-addon-unit]',
          line.quantity > 1 && !free
            ? unitTemplate.replace('{price}', money(added.unit_price))
            : null,
        );
        toggle.checked = added.item_id !== null;
        toggle.addEventListener('change', () => {
          toggle.disabled = true;
          box.setAttribute('aria-busy', 'true');
          void this.change('PUT', {
            cart_id: cart.id,
            item_id: line.id,
            addon: toggle.checked,
            kind: added.kind,
          });
        });
      }
    },
  );
}

export function defineKitCart(tagName = 'kit-cart'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const button = this.querySelector('button');
        button?.addEventListener('click', () => {
          if (isBusy(button)) return;
          busy(button, true);
          void this.addKit();
        });
        document.addEventListener(PRICES_FILLED_EVENT, () => this.priced());
      }

      priced(): void {
        const kit = this.closest<HTMLElement>('parts-list-add-all');
        const items = [
          ...(kit?.querySelectorAll<HTMLElement>('[data-kit-part]') ?? []),
        ];
        for (const item of items) {
          const offer =
            item.querySelector<HTMLElement>('[data-kit-offer]')?.dataset
              .kitOffer;
          if (offer) item.dataset.offerId = offer;
          else delete item.dataset.offerId;
        }
        const buyable = items.every((item) => item.dataset.offerId);
        this.hidden = !buyable;
        const ask = kit?.querySelector('[data-add-all]');
        ask?.classList.toggle('btn-secondary', buyable);
        ask?.classList.toggle('btn-primary', !buyable);
      }

      async addKit(): Promise<void> {
        const kit = this.closest<HTMLElement>('parts-list-add-all');
        const vin = vinFrom(location.search);
        let cartId = readCart()?.id ?? null;
        let moved = false;
        for (const item of kit?.querySelectorAll<HTMLElement>(
          '[data-offer-id]:not([hidden])',
        ) ?? []) {
          const outcome = await sendJson('POST', {
            cart_id: cartId,
            offer_id: item.dataset.offerId,
            quantity: Number(item.dataset.quantity) || 1,
          });
          if (outcome?.kind === 'cart') {
            rememberCart(outcome.cart);
            cartId = outcome.cart.id;
            continue;
          }
          const part = listedPartFromDataset(item.dataset, {
            car: kit?.dataset.car,
            ...(vin && { vin }),
          });
          if (part) addToPartsList(part);
          moved = true;
        }
        const href = this.dataset.cartHref ?? '';
        location.assign(
          moved
            ? `${href}?${new URLSearchParams({ [CART_NOTICE_PARAM]: 'moved' })}`
            : href,
        );
      }
    },
  );
}
