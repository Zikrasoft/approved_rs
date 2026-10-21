import * as z from 'zod/mini';
import { CART_NOTICE_PARAM } from '@/utils/cartNotice';
import { formatLeadTime } from '@/utils/leadTime';
import { formatMoney } from '@/utils/money';
import { addToPartsList, listedPartSchema } from './partsList';

export const CART_STORAGE_KEY = 'carlab_offer_cart';

const storedCartSchema = z.object({
  id: z.string(),
  parts: z.array(listedPartSchema),
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

const cartOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cart'), cart: offerCartSchema }),
  z.object({ kind: z.literal('empty') }),
  inquirySchema,
]);

type CartOutcome = z.infer<typeof cartOutcomeSchema>;

type CartStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const orBrowser = (storage?: CartStorage): CartStorage =>
  storage ?? localStorage;

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

export function rememberCart(cart: OfferCart, storage?: CartStorage): void {
  const stored: StoredCart = {
    id: cart.id,
    parts: cart.items.map(({ part }) => part),
  };
  try {
    orBrowser(storage).setItem(CART_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    return;
  }
}

export function forgetCart(storage?: CartStorage): void {
  try {
    orBrowser(storage).removeItem(CART_STORAGE_KEY);
  } catch {
    return;
  }
}

export function moveCartToInquiry(storage?: CartStorage): void {
  for (const part of readCart(storage)?.parts ?? []) {
    addToPartsList(part, storage);
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

export function definePartOffers(tagName = 'part-offers'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        this.addEventListener('click', (event) => {
          const button = (event.target as Element).closest<HTMLButtonElement>(
            '[data-buy]',
          );
          if (button) void this.buy(button);
        });
        void this.refresh();
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
          daysTemplate = '',
        } = this.dataset;
        const template = this.querySelector<HTMLTemplateElement>(
          'template[data-offer]',
        )!;
        const row = template.content.cloneNode(true) as DocumentFragment;
        fill(
          row,
          '[data-price]',
          formatMoney(offer.price, offer.currency, localeTag),
        );
        fill(
          row,
          '[data-stock]',
          offer.stock_quantity > 0
            ? `${stockLabel}: ${offer.stock_quantity}`
            : null,
        );
        fill(
          row,
          '[data-lead]',
          offer.lead_time_days > 0
            ? `${leadLabel}: ${formatLeadTime(offer.lead_time_days, { inStock, daysTemplate })}`
            : null,
        );
        row
          .querySelector<HTMLButtonElement>('[data-buy]')
          ?.setAttribute('data-offer-id', offer.id);
        return row;
      }

      async buy(button: HTMLButtonElement): Promise<void> {
        button.disabled = true;
        const outcome = await sendJson('POST', {
          cart_id: readCart()?.id ?? null,
          offer_id: button.dataset.offerId,
        });
        button.disabled = false;
        const added = outcome?.kind === 'cart';
        if (added) {
          rememberCart(outcome.cart);
        } else {
          const part = listedPartSchema.safeParse({ ...this.dataset });
          if (part.success) addToPartsList(part.data);
        }
        this.querySelector<HTMLElement>('[data-added]')!.hidden = !added;
        this.querySelector<HTMLElement>('[data-inquiry]')!.hidden = added;
      }
    },
  );
}

export function defineOfferCart(tagName = 'offer-cart'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const notice =
          new URLSearchParams(location.search).get(CART_NOTICE_PARAM) ?? '';
        if (notice === 'ordered') {
          forgetCart();
          this.show('ordered');
          return;
        }
        const stored = readCart();
        if (!stored) {
          this.show('empty');
          return;
        }
        this.querySelector('form')?.addEventListener('formdata', (event) => {
          const id = readCart()?.id;
          if (id) event.formData.set('cart_id', id);
        });
        void getJson(
          cartOutcomeSchema,
          `/api/cart?id=${encodeURIComponent(stored.id)}`,
        ).then((outcome) => this.render(outcome, notice));
      }

      show(state: string): void {
        for (const block of this.querySelectorAll<HTMLElement>(
          '[data-state]',
        )) {
          block.hidden = block.dataset.state !== state;
        }
      }

      render(outcome: CartOutcome | null, notice = ''): void {
        if (!outcome || outcome.kind === 'inquiry') {
          moveCartToInquiry();
          this.show('fallback');
          return;
        }
        if (outcome.kind === 'empty') {
          forgetCart();
          this.show('empty');
          return;
        }
        const { cart } = outcome;
        rememberCart(cart);
        const { localeTag = 'sr', quantityTemplate = '{count}' } = this.dataset;
        this.querySelector('[data-lines]')?.replaceChildren(
          ...cart.items.map((line) =>
            this.line(line, cart, localeTag, quantityTemplate),
          ),
        );
        fill(
          this,
          '[data-total]',
          formatMoney(cart.total, cart.currency, localeTag),
        );
        for (const block of this.querySelectorAll<HTMLElement>(
          '[data-notice]',
        )) {
          block.hidden = block.dataset.notice !== notice;
        }
        this.show('cart');
      }

      line(
        line: OfferCart['items'][number],
        cart: OfferCart,
        localeTag: string,
        quantityTemplate: string,
      ): Node {
        const template = this.querySelector<HTMLTemplateElement>(
          'template[data-line]',
        )!;
        const row = template.content.cloneNode(true) as DocumentFragment;
        const link = row.querySelector<HTMLAnchorElement>('[data-part-link]');
        if (link) {
          link.textContent = line.part.name;
          link.href = (this.dataset.partHref ?? '').replace(
            '{slug}',
            line.part.slug,
          );
        }
        fill(row, '[data-number]', `${line.part.brand} ${line.part.number}`);
        fill(
          row,
          '[data-quantity]',
          quantityTemplate.replace('{count}', String(line.quantity)),
        );
        fill(
          row,
          '[data-price]',
          formatMoney(
            line.unit_price * line.quantity,
            cart.currency,
            localeTag,
          ),
        );
        row.querySelector<HTMLElement>('[data-unavailable]')!.hidden =
          line.available;
        const remove = row.querySelector<HTMLButtonElement>('[data-remove]');
        remove?.setAttribute(
          'aria-label',
          `${remove.getAttribute('aria-label') ?? ''}: ${line.part.name}`,
        );
        remove?.addEventListener('click', async () => {
          remove.disabled = true;
          this.render(
            await sendJson('DELETE', {
              cart_id: cart.id,
              item_id: line.id,
            }),
          );
        });
        return row;
      }
    },
  );
}
