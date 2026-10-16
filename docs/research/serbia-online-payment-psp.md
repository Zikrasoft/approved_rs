# PSPs for online card payments on a Serbian shop: the landscape

Research for ticket [#326](https://github.com/Zikrasoft/approved_rs/issues/326).
Date: 2026-10-16.

**Scope: technical and commercial only.** This is not a legal opinion and does not
re-litigate whether click-and-collect counts as a distance contract, fiscalization,
or any other legal question for carlab.rs — that is
[`serbia-online-shop-legal.md`](serbia-online-shop-legal.md). The question here is
narrower: which payment service providers can actually process an online card
payment for a Serbian merchant, on what technical terms, and at roughly what cost.

## Source status

Same tags as the legal doc:

- **[P]** — a primary source (the provider's own docs/pricing/site) was read.
- **[S]** — a secondary source (blog, forum, press); the primary source was not
  read, or the primary source didn't say.
- **[NOT ESTABLISHED]** — could not be verified from any source found.

**Headline finding on cost:** almost no PSP in this market publishes an exact
merchant fee on their website. What is published is usually a *starting* or
*minimum* figure, with the real rate "negotiated depending on volume and risk" —
see the per-provider sections. Treat every percentage below as a floor, not a
quote, and budget time to actually talk to sales before committing to a number.

## Market structure note

**Monri, WSPay and NestPay are commercially related, not independent choices.**
Payten (the payments arm of Asseco South Eastern Europe, which also owns the
NestPay platform) bought 100% of WSPay and 80% of the merged Monri Payments d.o.o.
[P] — both now trade as "Monri WSPay" on wspay.info / monri.com.
[[payten.com — WSPay acquisition]](https://www.payten.com/en/news-events/news/payten-continuing-expansion-its-e-commerce-business-acquisition-one-first-payment-gateways-europe-wspay/)
[[payten.com — Monri acquisition]](https://www.payten.com/tr/news-events/news/payten-enters-independent-pos-deployment-market-acquiring-monri/)
So "Monri vs. WSPay" is not really two competitors to pick between — it's one
PSP group with two legacy brand names and separate country sites (monri.com,
wspay.info, wspay.si, wspay.eu). The same group (Payten/Asseco SEE) also builds
NestPay, the gateway several Serbian banks (Banca Intesa, AIK Banka) run their
own direct e-commerce acquiring on [S], so even the "go through your own bank"
path and the "go through a third-party aggregator" path can end up on
infrastructure from the same vendor. CorvusPay is the clearest independent
alternative in this list.

## Comparison table

| Provider | Integration shape | Card schemes / 3DS | Fees | Payout timing | Merchant requirements | Platform notes |
|---|---|---|---|---|---|---|
| **Monri WSPay** (monri.com / wspay.info) | Hosted redirect, iFrame/lightbox, "Monri Components" embedded form, mobile SDKs [P] | Visa, Mastercard, Maestro, Amex, Diners; DinaCard not confirmed on the public pages [P]. PSD2/3DS2 ("TriDes2, PCI 3DS") [P] | Annual fee **EUR 380+VAT**, waived above EUR 80,000/yr turnover in favour of a per-transaction fee starting at **0.50%** [P]; Monri's own pricing page separately quotes a EUR 36/month-or-0.5%-per-transaction floor plus a EUR 380 annual fee — the two pages don't fully reconcile, treat as "contact sales" [P] | Not published; "Monri Payments does not make payments... card companies handle payouts per agreed terms" [P] | Registered legal entity, webshop or payment-link setup, bank/acquirer paperwork [P] | Free plugins for WooCommerce, Shopify, Magento, PrestaShop, Shopware [P] |
| **CorvusPay** (corvuspay.com) | Hosted checkout / Internet Terminal, iframe, tokenization, Virtual POS (no 3DS/CVV option for registered cards) [P] | Visa, Mastercard, Maestro, Amex, Diners, Discover, **Dina** explicitly listed [P]. SCA/3DS/PSD2 supported [P] | License **EUR 30/month** (covers first EUR 30 of turnover); **1.30%+EUR0.04** per txn for EEA-issued private cards, **3.20%+EUR0.04** for non-EEA private cards, roughly double for business cards; **EUR 25** chargeback fee, **EUR 0.30** refund fee; separate EUR 4/month per extra terminal [P] | Not run by CorvusPay itself — "CorvusPay is not a bank"; timing is set by the merchant's own acquiring bank [P] | Merchants from Croatia, Bosnia, **Serbia**, and the EU can sign up [P]; RSD-denominated processing must go through a local acquiring bank, not Corvus's own cross-border rails [P] | WooCommerce plugin, Magento/Adobe Commerce extension, Google Pay integration guide; no Shopify app found [P] |
| **NestPay / Asseco SEE** (via a Serbian bank: Banca Intesa, AIK Banka, etc.) | API integration against the bank's NestPay instance (Windows COM, .NET, Java, XML, ASP, PHP APIs); hosted payment page option [P] | Visa, Mastercard, DinaCard confirmed via Banca Intesa's description [S]; 3D Secure MPI/ACS natively supported by NestPay [P] | Not published anywhere found — negotiated per merchant with the bank. **[NOT ESTABLISHED]** | Not published; presumably follows the bank's own merchant-acquiring agreement. **[NOT ESTABLISHED]** | Must bank with that specific institution, open a merchant/virtual-POS agreement, go through the bank's own KYC; "complete technical documentation, test cards, authorization-server access" provided during onboarding [S] | No off-the-shelf SaaS plugin ecosystem; integration is bespoke per bank, usually done through a local integrator (e.g. explicit.rs, holest.com build custom WooCommerce/OpenCart modules against a specific bank's NestPay) [S] |
| **AllSecure** (allsecure.rs) | Hosted/plugin checkout, API, Pay-by-Link [P] | Not itemized on the page found; markets cards + Apple Pay/Google Pay + IPS + BNPL generically [P]. 3DS not explicitly confirmed. **[NOT ESTABLISHED]** | ~EUR 100 one-time setup; banking fee "typically 1.5–3.5%" plus ~EUR 0.25 per transaction (per a secondary cost breakdown, not AllSecure's own published rate card) [S] | Not published. **[NOT ESTABLISHED]** | Not detailed on the pages fetched. **[NOT ESTABLISHED]** | Free WooCommerce module (tokenization, multi-currency, one-click pay); Shopify app ("AllSecure Global") live for several regional markets [P] |
| **Chip Card** (chipcard.rs) | Custom integration, described as "deployed in a short timeframe"; no public API docs found [S] | Visa, Mastercard, DinaCard, UnionPay [S] | "Flat tariffs, scalable tariffs, various pricing models" — no numbers published [P] | Not published. **[NOT ESTABLISHED]** | Licensed NBS e-money institution itself, so it is the acquirer, not a reseller of a bank's facility; merchant onboarding specifics not published. **[NOT ESTABLISHED]** | Not documented publicly. **[NOT ESTABLISHED]** |
| **PaySpot** (payspot.rs) | Not documented on the pages fetched — card acceptance, IPS QR, payment links are listed as services but with no integration detail [S] | Not documented. **[NOT ESTABLISHED]** | Not documented. **[NOT ESTABLISHED]** | Not documented. **[NOT ESTABLISHED]** | NBS-licensed e-money institution [P]; everything else **[NOT ESTABLISHED]** | Not documented. **[NOT ESTABLISHED]** |
| **Stripe** | N/A | N/A | N/A | N/A | **Does not support Serbian-registered legal entities as merchants** — Serbia is not on Stripe's supported-country list for a merchant/Connect account [S]. Serbia *is* supported for Stripe Tax (digital-goods VAT) only, which is a different product and irrelevant here [S]. The common workaround (forming a US or EU entity to get a Stripe account) moves the business's domicile, which is out of scope for "a Serbian merchant" | N/A |
| **PayPal** | Checkout button / API, but see requirements | Standard PayPal card processing | PayPal's standard published rates, not Serbia-specific | N/A — PayPal is a wallet, not a dinar-settlement acquirer | A Serbian PayPal business account can only receive **cross-border** payments from non-Serbian buyers; PayPal does not settle in RSD and domestic Serbia-to-Serbia transactions through PayPal are not permitted [S]. Not usable as the primary checkout for a Serbian shop whose customers are mostly local | Works as a secondary option for international buyers only |
| **Payoneer** | Payoneer Checkout — hosted page or plugin | Cards, Apple Pay, Google Pay, BNPL, "local payment methods" [P] | Not published for Serbia specifically. **[NOT ESTABLISHED]** | Funds land in the merchant's Payoneer balance, not directly in a dinar account; further transfer to a local bank is a separate step with its own fees/timing. **[NOT ESTABLISHED]** on exact timing | Payoneer Checkout markets itself as available to Serbian businesses [S], but it is built for cross-border e-commerce, same caveat as PayPal re: local RSD settlement. **[NOT ESTABLISHED]** whether it supports RSD settlement at all | WooCommerce, Magento, Shoplazza, Ueeshop integrations listed; no native Shopify/Medusa integration found [P] |

## Per-provider detail

### Monri WSPay

Monri Payments and WSPay are the same corporate group (Payten/Asseco SEE) trading
under two legacy brand names; see the market-structure note above. Monri's own
product page lists iFrame/pop-up, redirect, and "webshop form" (embedded)
integration, plus Android/iOS SDKs and ready plugins for WooCommerce, Shopify,
Magento, PrestaShop and Shopware [[monri.com]](https://monri.com/products/online-payments/).
3DS/PSD2 compliance is stated as "PSD2 compliant, TriDes2, PCI 3DS"
[[monri.com]](https://monri.com/products/online-payments/). Pricing on that page:
minimum EUR 36/month *or* 0.5% per transaction, plus an EUR 380 annual fee, first
setup free [[monri.com]](https://monri.com/products/online-payments/) — this does
not cleanly match the WSPay price list, which states EUR 380/year waived above
EUR 80,000 annual turnover in favour of a 0.50%-and-up variable fee
[[wspay.si — price list]](https://www.wspay.si/cd/283/price-list-of-monri-wspay-products-and-services).
Treat both as indicative floors, not a quote. WSPay confirms Visa, Mastercard,
Maestro, Amex and Diners, and that Serbia is one of its served markets (alongside
Croatia, Montenegro, Slovenia, Bosnia)
[[wspay.info]](https://www.wspay.info/). **DinaCard support was not confirmed** on
any Monri/WSPay page fetched — worth asking sales directly given carlab.rs's
customer base will carry a lot of DinaCard. Settlement timing is explicitly
disclaimed: "Monri Payments does not make payments and has no insight into when
the funds will be deposited into your account" — that is between the merchant and
the card schemes/acquiring bank
[[monri.com]](https://monri.com/products/online-payments/).

### CorvusPay

The strongest documentation of any provider researched, and the only one that
explicitly names Serbia as an eligible merchant market and explicitly lists
**Dina** (DinaCard) as a supported scheme, alongside Visa, Mastercard, Maestro,
Amex, Diners and Discover
[[corvuspay.com/faq]](https://www.corvuspay.com/en/faq/). SCA/3DS/PSD2 is
supported, with a "Virtual POS" option that can skip 3DS/CVV for recognised
customers [[corvuspay.com]](https://www.corvuspay.com/en/company/). Pricing is
unusually specific for this market: a EUR 30/month service licence (covering the
first EUR 30 of processed volume), card-acquiring fees of 1.30%+EUR0.04 per
transaction for EEA-issued private cards, 3.20%+EUR0.04 for non-EEA-issued private
cards (roughly double for business cards), a EUR 25 chargeback fee and a EUR 0.30
refund fee, all ex-VAT
[[corvuspay.com/pricing]](https://www.corvuspay.com/en/pricing/). Settlement
timing is not CorvusPay's to set — "CorvusPay is not a bank and does not provide
banking services"; the acquiring bank sets payout terms
[[corvuspay.com/faq]](https://www.corvuspay.com/en/faq/). **Open question:** where
a Serbian d.o.o. is settled in RSD, is the acquiring bank a Serbian bank CorvusPay
has a relationship with, or does Corvus route Serbian merchants through its
Croatian acquiring relationships — the FAQ mentions Teya/Worldline for
international-currency processing but doesn't spell out the RSD path
[[corvuspay.com/faq]](https://www.corvuspay.com/en/faq/). **[NOT ESTABLISHED]**,
needs a direct sales conversation. Platform support: a WooCommerce plugin and a
Magento/Adobe Commerce extension exist
[[wordpress.org]](https://en-gb.wordpress.org/plugins/corvuspay-woocommerce-integration/)
[[commercemarketplace.adobe.com]](https://commercemarketplace.adobe.com/corvus-pay-payment-gateway.html);
no Shopify app was found.

### NestPay / a Serbian bank's own gateway (Banca Intesa, AIK Banka, etc.)

NestPay is Payten/Asseco SEE's bank-facing gateway product; it is not something a
merchant contracts directly — a merchant contracts with the *bank*, and the bank
runs NestPay underneath
[[payten.com]](https://www.payten.com/en/offers/for-payment-financial-institutions/e-commerce/payment-gateway/).
Banca Intesa and AIK Banka are the Serbian banks confirmed to run on this platform
[S, from search result summaries rather than a bank page actually read — Banca
Intesa's own e-commerce page returned HTTP 403 to automated fetching]. NestPay
itself supports a wide API surface (Windows COM, .NET, Java, XML, ASP, PHP) and
native 3D Secure MPI/ACS
[[payten.com]](https://www.payten.com/en/offers/for-payment-financial-institutions/e-commerce/payment-gateway/).
A Serbian integrator's write-up of the Banca Intesa flow confirms the shape — a
programmer does an API integration against the bank's NestPay instance, gets an
admin panel for refunds/reversals/reporting, and goes through PCI DSS controls —
but does not publish fees, settlement timing, or a scheme list
[[explicit.rs]](https://explicit.rs/article/api-integracija-internet-prodavnice-sa-banca-intesa-online-placanjem).
A secondary source lists Visa, Mastercard and DinaCard as accepted on Banca
Intesa's e-commerce service [S]. **Fees, onboarding documents and settlement
timing are all [NOT ESTABLISHED]** from a primary source — this is a "go talk to
your bank" path by construction, not a self-service signup. No generic plugin
ecosystem exists; third-party developers (explicit.rs, holest.com) sell bespoke
WooCommerce/OpenCart/VirtueMart modules per bank
[[holest.com]](https://holest.com/products/woocommerce-banca-intesa-nestpay-payment-method.html).

### AllSecure

Markets itself with ready plugins for WooCommerce, Shopify and Wix, plus a raw API
and Pay-by-Link option, and bundles IPS instant-transfer and BNPL alongside card
acceptance [[allsecure.rs]](https://allsecure.rs/en/online-placanje-za-biznise/).
No card-scheme list or explicit 3DS confirmation was found on the pages fetched —
**[NOT ESTABLISHED]**. Pricing shown is a cost *illustration*, not a rate card: a
roughly EUR 100 one-off setup fee, a banking fee described as "typically
1.5%–3.5%", and a flat ~EUR 0.25-per-transaction provider fee, used in the source
to model an example shop at ~2.8% all-in
[[allsecure.rs]](https://allsecure.rs/en/online-placanje-za-biznise/) — this reads
as AllSecure's own worked example rather than a guaranteed rate, but it is at
least AllSecure's own page making the estimate, so it is tagged [P] with the
caveat that it's illustrative. Settlement timing and merchant onboarding
requirements were not found — **[NOT ESTABLISHED]**. A free WooCommerce module
(tokenized cards, multi-currency, one-click payment) exists
[[allsecure.rs blog]](https://www.allsecure.rs/woocommerce-modul-za-allsecure-payment-gateway/),
and a Shopify app ("AllSecure Global") is live for a list of regional markets
[[cartdna.com]](https://www.cartdna.com/shopify-payment-methods/allsecure-global) —
whether Serbia specifically is in that Shopify-app market list was not confirmed.
**[NOT ESTABLISHED]**.

### Chip Card

An NBS-licensed electronic-money institution (licensed 2021) whose licence
explicitly covers "prihvatanje platnih kartica kupaca na prodajnim mestima
Internet trgovaca i prenos novčanih sredstava trgovcima" — i.e. it is itself an
acquirer for internet merchants, not a reseller sitting on top of a bank's
facility [[chipcard.rs]](https://chipcard.rs/o-nama). It lists Visa, Mastercard,
DinaCard and UnionPay as supported schemes [S] and markets "flat tariffs,
scalable tariffs, transparent invoicing, various pricing models" with no actual
numbers published [[chipcard.rs]](https://chipcard.rs/o-nama). Settlement timing,
onboarding documents and integration shape (hosted page vs. API vs. plugin) were
not documented on the pages found — **[NOT ESTABLISHED]** across the board beyond
the licence and scheme list.

### PaySpot

Also an NBS-licensed e-money institution (Novi Sad, founded 2015, e-money licence
granted 2023), and an indirect participant in NBS's instant-payment system (IPS)
through OTP Banka Srbija [[seenews.com]](https://seenews.com/news/serbias-payspot-joins-central-banks-instant-payment-system-1255995)
[[ips.nbs.rs]](https://ips.nbs.rs/en/vesti/institucija-elektronskog-novca-payspot-doo-novi-sad-prikljucila-se-u-ips-nbs-sistem).
PaySpot's own "About us" page names card payments, IPS QR, payment links and POS
terminals among its services but gives no integration detail, fee, scheme list,
or settlement timing on the pages fetched [[payspot.rs]](https://www.payspot.rs/en/o-nama).
Everything beyond "it exists, it is licensed, it claims to do card acceptance" is
**[NOT ESTABLISHED]** without a direct sales conversation.

### Stripe

**Does not currently support Serbian-registered legal entities as Stripe
merchants.** Serbia is absent from Stripe's list of countries where a business can
open a Stripe/Connect merchant account [S, aggregated from third-party country-list
trackers rather than Stripe's own page, since Stripe doesn't publish a single
authoritative "merchant-eligible countries" list distinct from its global-coverage
marketing page]. Serbia *is* listed as a supported jurisdiction for **Stripe Tax**
(VAT handling on digital goods) as of October 2024 — a separate, narrower product
that has nothing to do with accepting card payments as a merchant
[[docs.stripe.com/tax/supported-countries]](https://docs.stripe.com/tax/supported-countries).
The workaround discussed online — incorporating a US or EU entity specifically to
get Stripe access — changes the business's legal domicile and is out of scope for
"a Serbian merchant"; it is not a way to use Stripe *as* carlab.rs's d.o.o.

### PayPal

A Serbian business can hold a PayPal business account, but only for **cross-border**
money movement: receiving payments from non-Serbian buyers, or paying non-Serbian
suppliers. PayPal does not settle in RSD, and domestic Serbia-to-Serbia payment
transactions through PayPal are reported as not permitted under Serbian foreign-
exchange rules [S, aggregated from a Serbian compliance-advisory site and a PayPal
Community thread rather than a PayPal policy page naming Serbia specifically — no
single PayPal primary source enumerating this restriction for Serbia was found].
This rules PayPal out as the primary checkout method for a shop whose buyers are
mostly local; it could still sit as a secondary option for the rare international
buyer.

### Payoneer

Payoneer Checkout is marketed as usable by Serbian businesses and supports cards,
Apple Pay, Google Pay, BNPL and other local methods, with integrations for
WooCommerce, Magento, Shoplazza and Ueeshop
[[payoneer.com/checkout]](https://www.payoneer.com/checkout/). Like PayPal, it is
built around a Payoneer balance rather than direct-to-dinar-account settlement —
funds land in the merchant's Payoneer account first, and moving them to a local
RSD bank account is a separate step whose fee and timing were not found on
Payoneer's public pages. **[NOT ESTABLISHED]** whether Payoneer Checkout supports
RSD settlement at all, or only USD/EUR balances with a subsequent conversion —
this is the single most important unanswered question before considering it, and
it needs a direct conversation with Payoneer support, not more web search.

## Recommendation

For a small/mid Serbian auto-parts shop doing cash-at-pickup now and planning card
payment as a fast-follow, **CorvusPay and Monri WSPay are the two worth getting on
a call with first.**

- **CorvusPay** has the best public documentation of the group, explicitly serves
  Serbian merchants, explicitly supports DinaCard (important given a domestic
  car-parts buyer base will carry a lot of Dina-only cards), and is the only
  provider in this list with an actual published rate card rather than a vague
  "contact sales." It is also the one genuinely independent option — not
  commercially entangled with the bank-gateway/NestPay cluster.
- **Monri WSPay** is the other realistic default: it's the PSP most often cited as
  "what everyone already uses" for e-commerce in this region [S], has free plugins
  for WooCommerce and the other mainstream platforms, and a published (if
  somewhat inconsistent between its own pages) EUR 380/year-or-%-of-turnover
  pricing floor. Its gap against CorvusPay is that DinaCard support could not be
  confirmed from its public pages — worth asking directly before picking it over
  CorvusPay.

Going through a specific bank's NestPay-based gateway (Banca Intesa, AIK Banka)
only makes sense if carlab.rs already banks there and wants to avoid adding a
third-party PSP relationship — but the complete absence of public pricing and
settlement-timing information makes it impossible to compare against CorvusPay or
Monri without a direct conversation, and the integration is bespoke rather than a
drop-in plugin.

**Stripe, PayPal and Payoneer are not viable as the primary card-payment rail**
for this shop: Stripe doesn't accept Serbian merchant entities at all, PayPal
can't settle domestic RSD transactions, and Payoneer's RSD-settlement capability
is unconfirmed and built around a cross-border balance rather than a local account
— all three are, at best, secondary options for a foreign buyer, not the checkout
a Belgrade-based auto-parts buyer will use.

AllSecure, Chip Card and PaySpot are real, NBS-connected or NBS-licensed options,
but none of them published enough (fees, settlement timing, scheme list,
onboarding requirements) to recommend over CorvusPay or Monri WSPay without a
direct sales conversation.

## What remains unverified — needs a direct sales conversation

1. **Exact current percentage fees for Monri WSPay** — the product page and the
   price list don't fully agree, and real-world rates are described as negotiated.
2. **Whether Monri WSPay and NestPay support DinaCard at all** — neither's public
   pages confirmed it, unlike CorvusPay which does.
3. **Settlement/payout timing to a dinar account for every provider in this
   list** — not one provider's public pages stated a concrete T+N figure; all of
   them defer to "the acquiring bank's terms."
4. **Which Serbian bank(s) CorvusPay's RSD settlement actually runs through** —
   the FAQ names Teya/Worldline for foreign-currency processing but doesn't say
   who handles RSD.
5. **AllSecure's actual rate card, 3DS support, card-scheme list, and whether its
   Shopify app covers Serbia** — only a secondary cost illustration was found.
6. **Chip Card's and PaySpot's integration shape, fees, and onboarding
   requirements** — both are confirmed as NBS-licensed and confirmed to offer
   card acceptance in principle, but neither publishes operational detail.
7. **Whether Payoneer Checkout settles in RSD** to a Serbian bank account, or only
   in foreign currency to a Payoneer balance.
8. **Required onboarding/KYC documents** for any of the providers above — none of
   the pages fetched gave a document checklist; expect the usual d.o.o.
   registration extract, PIB, UBO/ownership disclosure and a dinar settlement
   account at minimum, but this is an inference, not a sourced fact.

## Sources

Primary sources (the provider's own docs/pricing/site was read):

- Monri Payments, online payments product page —
  https://monri.com/products/online-payments/
- Monri WSPay, price list —
  https://www.wspay.si/cd/283/price-list-of-monri-wspay-products-and-services
- Monri WSPay, main site (Serbia listed as a served market) —
  https://www.wspay.info/
- CorvusPay, company/security page —
  https://www.corvuspay.com/en/company/
- CorvusPay, pricing —
  https://www.corvuspay.com/en/pricing/
- CorvusPay, FAQ (country eligibility, settlement, schemes) —
  https://www.corvuspay.com/en/faq/
- CorvusPay WooCommerce plugin —
  https://en-gb.wordpress.org/plugins/corvuspay-woocommerce-integration/
- CorvusPay Adobe Commerce/Magento extension —
  https://commercemarketplace.adobe.com/corvus-pay-payment-gateway.html
- Payten, e-commerce/NestPay payment gateway page —
  https://www.payten.com/en/offers/for-payment-financial-institutions/e-commerce/payment-gateway/
- Payten, news on the WSPay acquisition —
  https://www.payten.com/en/news-events/news/payten-continuing-expansion-its-e-commerce-business-acquisition-one-first-payment-gateways-europe-wspay/
- Payten, news on the Monri acquisition —
  https://www.payten.com/tr/news-events/news/payten-enters-independent-pos-deployment-market-acquiring-monri/
- AllSecure, online payments for businesses —
  https://allsecure.rs/en/online-placanje-za-biznise/
  and WooCommerce module blog post —
  https://www.allsecure.rs/woocommerce-modul-za-allsecure-payment-gateway/
- Chip Card, "o nama" —
  https://chipcard.rs/o-nama
- PaySpot, "o nama" (EN) —
  https://www.payspot.rs/en/o-nama
- NBS, IPS participation notice for PaySpot —
  https://ips.nbs.rs/en/vesti/institucija-elektronskog-novca-payspot-doo-novi-sad-prikljucila-se-u-ips-nbs-sistem
- NBS, card operations costs of PSPs in Serbia, end-2024 —
  https://www.nbs.rs/sr_RS/scripts/showcontent/index.html?id=21187&konverzija=no
  (confirms the regulatory/interchange backdrop; names no specific PSP)
- Stripe docs, supported countries for Stripe Tax —
  https://docs.stripe.com/tax/supported-countries
- Payoneer, Checkout product page —
  https://www.payoneer.com/checkout/

Secondary sources (not primary, used for triangulation and flagged as [S] inline):

- explicit.rs, on integrating a webshop with Banca Intesa's NestPay —
  https://explicit.rs/article/api-integracija-internet-prodavnice-sa-banca-intesa-online-placanjem
- holest.com, Banca Intesa NestPay WooCommerce plugin listing —
  https://holest.com/products/woocommerce-banca-intesa-nestpay-payment-method.html
- reload.rs, "Online plaćanje na sajtu: sistemi i procedura" (2026) —
  https://reload.rs/blog/online-placanje-u-srbiji/
- cartdna.com, AllSecure Global on Shopify for Croatia —
  https://www.cartdna.com/shopify-payment-methods/allsecure-global
- tmconsulting.co.rs, PayPal in Serbia legal/compliance guide —
  https://tmconsulting.co.rs/what-is-paypal-and-how-to-use-it-in-serbia/
- PayPal Community thread, receiving payments in Serbia —
  https://www.paypal-community.com/t5/NVP-SOAP-APIs/My-business-is-in-Serbia-how-can-I-receive-payments-with-paypal/td-p/2964831
- seenews.com, PaySpot joining NBS's instant-payment system —
  https://seenews.com/news/serbias-payspot-joins-central-banks-instant-payment-system-1255995

Attempted but blocked:

- https://www.bancaintesa.rs/en/privreda/prihvatanje-platnih-kartica/e-commerce.html
  returned HTTP 403 to automated fetching; the explicit.rs secondary source was
  used instead for the Banca Intesa integration shape.
