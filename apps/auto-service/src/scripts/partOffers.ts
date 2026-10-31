import type { PartOffer } from '@podbor/catalog-contract/cart-wire';
import { rankOffers } from '@podbor/catalog-contract/availability';
import { offerAvailability, type LeadTimeCopy } from '@/utils/leadTime';
import { formatMoney } from '@/utils/money';
import { offersOutcomeSchema } from '@/utils/catalogueWire';
import { keepCartId, readCart, rememberCart } from './cartStore';
import { busy, fill, getJson, isBusy, sendJson, showOnly } from './cartUi';
import { shopPreview } from './shopPreview';
import {
  addToPartsList,
  listedPartFromDataset,
  type ListedPart,
} from './partsList';

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
        const [best, ...others] = rankOffers(outcome.offers);
        this.querySelector('[data-offers]')?.replaceChildren(this.row(best));
        this.querySelector('[data-more-offers]')?.replaceChildren(
          ...others.map((offer) => this.row(offer, true)),
        );
        const more = this.querySelector<HTMLElement>('[data-more]');
        if (more) more.hidden = others.length === 0;
        fill(
          this,
          '[data-more-count]',
          (this.dataset.moreLabel ?? '').replace(
            '{count}',
            String(others.length),
          ),
        );
        if (this.hidden) {
          this.hidden = false;
          (this.nextElementSibling as HTMLElement | null)?.setAttribute(
            'hidden',
            '',
          );
        }
      }

      row(offer: PartOffer, secondary = false): Node {
        const { localeTag = 'sr', availability = '' } = this.dataset;
        const template = this.querySelector<HTMLTemplateElement>(
          'template[data-offer]',
        )!;
        const row = template.content.cloneNode(true) as DocumentFragment;
        const { stock, lead, buyable } = offerAvailability(
          offer,
          JSON.parse(availability) as LeadTimeCopy,
          localeTag,
        );
        fill(
          row,
          '[data-price]',
          formatMoney(offer.price, offer.currency, localeTag),
        );
        fill(row, '[data-stock]', stock);
        fill(row, '[data-lead]', lead);
        row.querySelector<HTMLElement>('[data-out]')!.hidden = buyable;
        row.querySelector<HTMLElement>('[data-ask]')!.hidden = buyable;
        const buy = row.querySelector<HTMLButtonElement>('[data-buy]')!;
        buy.hidden = !buyable;
        buy.setAttribute('data-offer-id', offer.id);
        if (secondary) buy.classList.replace('btn-primary', 'btn-secondary');
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
