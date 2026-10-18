export const CART_ID_STORAGE_KEY = 'carlab_offer_cart_id';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export function readCartId(
  storage: ReadableStorage = localStorage,
): string | null {
  try {
    return storage.getItem(CART_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeCartId(
  id: string,
  storage: WritableStorage = localStorage,
): void {
  try {
    storage.setItem(CART_ID_STORAGE_KEY, id);
  } catch {
    // TODO: surface a visible notice if storage is blocked (private browsing)
  }
}

export function isOfferPriceChangedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return false;
  }
  const response = (error as { response?: { data?: { code?: unknown } } })
    .response;
  return response?.data?.code === 'OFFER_PRICE_CHANGED';
}

type CartItem = {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
};

type OfferCartResponse = {
  cart?: { id: string; items?: CartItem[]; total?: number };
};

async function postJson(
  url: string,
  publishableKey: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: OfferCartResponse }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-publishable-api-key': publishableKey,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw { response: { status: response.status, data } };
  }
  return { status: response.status, data };
}

async function ensureCartId(
  backendUrl: string,
  publishableKey: string,
): Promise<string> {
  const existing = readCartId();
  if (existing) return existing;
  const { data } = await postJson(
    `${backendUrl}/store/offer-carts`,
    publishableKey,
    {},
  );
  const id = data.cart!.id;
  writeCartId(id);
  return id;
}

export function defineOfferCartBuy(tagName = 'offer-cart-buy'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        this.querySelector('button')?.addEventListener('click', () => {
          this.buy();
        });
      }

      async buy(): Promise<void> {
        const button = this.querySelector('button');
        const errorEl = this.querySelector('[data-error]');
        const {
          backendUrl = '',
          publishableKey = '',
          offerId = '',
          cartPath = '',
        } = this.dataset;
        if (button) button.setAttribute('disabled', '');
        errorEl?.setAttribute('hidden', '');
        try {
          const cartId = await ensureCartId(backendUrl, publishableKey);
          await postJson(
            `${backendUrl}/store/offer-carts/${cartId}/items`,
            publishableKey,
            { offer_id: offerId, quantity: 1 },
          );
          location.href = cartPath;
        } catch {
          button?.removeAttribute('disabled');
          errorEl?.removeAttribute('hidden');
        }
      }
    },
  );
}

function renderItems(
  root: HTMLElement,
  items: CartItem[],
  currencyLabel: string,
): void {
  const template = root.querySelector('template');
  const list = root.querySelector('[data-items]');
  if (!template || !list) return;
  list.replaceChildren(
    ...items.map((item) => {
      const row = (template.content.firstElementChild as HTMLElement).cloneNode(
        true,
      ) as HTMLElement;
      row.querySelector('[data-title]')!.textContent = item.title;
      row.querySelector('[data-quantity]')!.textContent = String(item.quantity);
      row.querySelector('[data-price]')!.textContent =
        `${item.unit_price.toLocaleString('sr-RS')} ${currencyLabel}`;
      return row;
    }),
  );
}

export function defineOfferCartView(tagName = 'offer-cart-view'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      async connectedCallback(): Promise<void> {
        const {
          backendUrl = '',
          publishableKey = '',
          mode,
          currencyLabel = '',
        } = this.dataset;
        const cartId = readCartId();
        if (!cartId) {
          this.querySelector('[data-empty]')?.removeAttribute('hidden');
          this.querySelector('[data-loaded]')?.setAttribute('hidden', '');
          return;
        }

        const cart = await this.fetchCart(backendUrl, publishableKey, cartId);
        if (!cart) return;

        this.querySelector('[data-loaded]')?.removeAttribute('hidden');
        renderItems(this, cart.items ?? [], currencyLabel);
        const totalEl = this.querySelector('[data-total]');
        if (totalEl) {
          totalEl.textContent = `${Number(cart.total ?? 0).toLocaleString('sr-RS')} ${currencyLabel}`;
        }

        if (mode === 'checkout') {
          this.wireCheckout(backendUrl, publishableKey, cartId);
        }
      }

      async fetchCart(
        backendUrl: string,
        publishableKey: string,
        cartId: string,
      ): Promise<{ items: CartItem[]; total: number } | null> {
        const response = await fetch(`${backendUrl}/store/carts/${cartId}`, {
          headers: { 'x-publishable-api-key': publishableKey },
        });
        if (!response.ok) return null;
        const body = await response.json();
        return body.cart;
      }

      wireCheckout(
        backendUrl: string,
        publishableKey: string,
        cartId: string,
      ): void {
        this.querySelector('[data-complete]')?.addEventListener('click', () => {
          this.complete(backendUrl, publishableKey, cartId);
        });
        this.querySelector('[data-reprice]')?.addEventListener('click', () => {
          this.reprice(backendUrl, publishableKey, cartId);
        });
      }

      async complete(
        backendUrl: string,
        publishableKey: string,
        cartId: string,
      ): Promise<void> {
        this.querySelector('[data-stale]')?.setAttribute('hidden', '');
        this.querySelector('[data-order-placed]')?.setAttribute('hidden', '');
        try {
          await postJson(
            `${backendUrl}/store/carts/${cartId}/complete`,
            publishableKey,
            {},
          );
          this.querySelector('[data-order-placed]')?.removeAttribute('hidden');
          this.querySelector('[data-checkout-form]')?.setAttribute(
            'hidden',
            '',
          );
        } catch (error) {
          if (isOfferPriceChangedError(error)) {
            this.querySelector('[data-stale]')?.removeAttribute('hidden');
            return;
          }
          this.querySelector('[data-error]')?.removeAttribute('hidden');
        }
      }

      async reprice(
        backendUrl: string,
        publishableKey: string,
        cartId: string,
      ): Promise<void> {
        const { currencyLabel = '' } = this.dataset;
        const { data } = await postJson(
          `${backendUrl}/store/offer-carts/${cartId}/reprice`,
          publishableKey,
          {},
        );
        renderItems(this, data.cart?.items ?? [], currencyLabel);
        const totalEl = this.querySelector('[data-total]');
        if (totalEl) {
          totalEl.textContent = `${Number(data.cart?.total ?? 0).toLocaleString('sr-RS')} ${currencyLabel}`;
        }
        this.querySelector('[data-stale]')?.setAttribute('hidden', '');
      }
    },
  );
}
