import {
  CART_FINGERPRINT_FIELD,
  cartFingerprint,
  cartTotals,
} from '@podbor/catalog-contract/fingerprint';
import type {
  AddonKind,
  OfferCart,
  OfferCartLine as CartLine,
} from '@podbor/catalog-contract/cart-wire';
import {
  CART_LINES_FIELD,
  CART_NOTICE_PARAM,
  ORDER_NUMBER_PARAM,
  ORDERED_CART_PARAM,
} from '@/utils/cartNotice';
import { cartOutcomeSchema, type CartOutcome } from '@/utils/catalogueWire';
import { leadTimeCopyFrom, offerAvailability } from '@/utils/leadTime';
import { formatMoney } from '@/utils/money';
import {
  forgetOrderedCart,
  listedLine,
  orderLines,
  moveCartToInquiry,
  orderedNumber,
  priceChanges,
  readCart,
  readReceipt,
  rememberCart,
  rememberReceipt,
  settleCart,
  unavailableNames,
  type PriceChange,
} from './cartStore';
import {
  forgetCheckout,
  rememberCheckout,
  restoreCheckout,
} from './checkoutMemory';
import { busy, fill, getJson, isBusy, sendJson, showOnly } from './cartUi';
import { shopPreview } from './shopPreview';
import { addonLabel, addToPartsList } from './partsList';

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

export const capNotice = ({
  lead_time_days,
}: Pick<CartLine, 'lead_time_days'>): string =>
  lead_time_days > 0 ? 'order-limit' : 'stock-limit';

export function defineOfferCart(tagName = 'offer-cart'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      cart: OfferCart | null = null;
      targets = new Map<string, number>();
      settle: ReturnType<typeof setTimeout> | undefined;
      stepNotice = '';
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
        window.addEventListener('pageshow', (event) => {
          if (event.persisted) location.reload();
        });
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
            event.formData.set(CART_LINES_FIELD, orderLines(this.cart));
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
        const summary = cartTotals(cart.items);
        fill(this, '[data-receipt-addons]', money(summary.addons));
        fill(this, '[data-receipt-total]', money(cart.total));
        this.querySelector<HTMLElement>('[data-receipt-addon-row]')!.hidden =
          summary.addons === 0;
        this.querySelector<HTMLElement>('[data-ordered-body]')!.hidden = true;
        this.querySelector<HTMLElement>('[data-receipt]')!.hidden = false;
      }

      readiness(line: CartLine, localeTag: string): string | null {
        const copy = leadTimeCopyFrom(this.dataset.availability);
        if (!copy) return null;
        const { stock, lead } = offerAvailability(line, copy, localeTag);
        return stock ?? lead;
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
        const summary = cartTotals(cart.items);
        const money = (amount: number) =>
          formatMoney(amount, cart.currency, localeTag);
        for (const node of this.querySelectorAll('[data-total]')) {
          node.textContent = money(cart.total);
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

      change(
        method: string,
        body: Record<string, unknown>,
        notice = '',
      ): Promise<void> {
        this.queue = this.queue.then(async () =>
          this.render(await sendJson(method, body), notice),
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
        if (capped) {
          this.stepNotice = capNotice(line);
          showOnly(this, 'data-notice', this.stepNotice);
        }
        if (target === current) return;
        this.targets.set(line.id, target);
        fill(row, '[data-quantity]', String(target));
        row.setAttribute('aria-busy', 'true');
        clearTimeout(this.settle);
        this.settle = setTimeout(() => {
          const notice = this.stepNotice;
          this.stepNotice = '';
          for (const [itemId, quantity] of this.targets) {
            void this.change(
              'PATCH',
              { cart_id: this.cart?.id, item_id: itemId, quantity },
              notice,
            );
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
            kind: 'service',
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
          kind: AddonKind;
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
            on: toggle.checked,
            kind: added.kind,
          });
        });
      }
    },
  );
}
