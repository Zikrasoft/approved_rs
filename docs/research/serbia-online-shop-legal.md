# An online car parts shop in Serbia: what the law requires

Research for ticket [#67](https://github.com/Zikrasoft/approved_rs/issues/67)
(part of #61). Date: 2026-09-29.

**This is not legal advice.** The goal is to understand which texts and fields the
site has to carry at all. A Serbian lawyer must review the text before a legal page
goes live on a real shop.

**Scenario:** a shop in Belgrade sells car parts to consumers. The order is placed
online, there is no delivery, and payment is in cash or by card on collection at the
shop (pickup).

## Source status

The tags used below:

- **[P]** — the primary source was read (the text of the act or secondary
  instrument), and the quotation was checked.
- **[S]** — a secondary source (a law firm, Paragraf, the press); the primary source
  was not read.
- **[NOT ESTABLISHED]** — could not be verified; there is no answer.

## The headline: the act changed in 2026

**Zakon o zaštiti potrošača («Sl. glasnik RS», br. 35/2026)** is new. [P]

- Art. 220: in force on the eighth day after publication, **applied after three
  months** from entry into force, except art. 4 para. 1 and **art. 6, which apply
  from entry into force**.
- Art. 219: from the day the new act starts to apply, **ZZP 88/21 ceases to have
  effect**.
- The actual dates (secondary sources, in agreement): in force from **2026-05-01**,
  applied from **2026-08-02**. [S]

As of today (2026-09-29) **35/2026** is in force. Any "terms of sale" template
downloaded from the internet that cites 88/2021 or "član 27 ZZP" is out of date: the
article numbering is different.

Zakon o trgovini — **«Sl. glasnik RS», br. 52/2019 i 35/2026** (also amended in
2026). [P]

Zakon o elektronskoj trgovini — **41/2009, 95/2013 i 52/2019**, unchanged. [P]

## 1. Mandatory seller details on the site

The requirements come from three acts and **add up** rather than replacing one
another.

### Zakon o elektronskoj trgovini, član 6 [P]

An information-society service provider must, «u obliku i na način koji je
**neposredno i stalno dostupan**» (that is, by a permanently accessible means —
usually the footer plus a dedicated page), provide:

1. the first and last name, or the business name (`naziv`);
2. the place of establishment (`sedište`);
3. other details for quick and unimpeded contact, **including an email address**;
4. details of the entry in the Registar privrednih subjekata (i.e. APR / the
   matični broj);
5. information about the supervisory body, if the activity is supervised;
6. (for regulated professions — not our case);
7. the **PIB**, and the VAT registration number from the VAT registration
   certificate if the seller is VAT registered.

The same article, para. 2: «Ako pružalac usluga navodi cene, one moraju biti jasno i
nedvosmisleno naznačene, a posebno mora naznačiti **da li su u te cene uključeni
troškovi dostave, ostali manipulativni troškovi, porez i drugi troškovi** koji na
njih utiču.»

### Zakon o trgovini, član 32 [P]

- Para. 1: at the point of sale, visibly display the **poslovno ime, matični broj i
  adresu sedišta**.
- Para. 3: at a retail outlet — also **the outlet's own address**.
- Para. 5: «Trgovac i pružalac usluge **u daljinskoj trgovini** dužni su da
  potrošaču **pre kupovine** učine dostupnim podatke iz st. 1. i 2. ovog člana.» —
  i.e. the same poslovno ime / matični broj / adresa sedišta, on the site, before the
  purchase.

### Zakon o zaštiti potrošača 35/2026, član 12 st. 1 t. 2 [P]

Before the contract is concluded, «na jasan i razumljiv način **na srpskom jeziku**»,
inform the consumer of the «**poslovnom imenu, matičnom broju, adresi sedišta i
broju telefona**».

Note: ZZP requires a **phone number** but does not require the PIB; the PIB is
required by ZET. Together they make the full set.

### Zakon o zaštiti potrošača 35/2026, član 27 st. 1 t. 1 [P]

For a distance contract, in addition to art. 12:

> «geografskoj adresi na kojoj posluje ako ne posluje na adresi sedišta, **adresi
> elektronske pošte**, nazivu i adresi trgovca u čije ime postupa, kao i o drugim
> sredstvima komunikacije koja omogućavaju potrošaču da **na trajnom nosaču podataka
> sačuva prepisku** sa trgovcem, što uključuje datum i vreme komunikacije»

Art. 27 para. 7: these details must be provided **in Serbian**.
Art. 27 para. 8: the details become **part of the contract**.
Art. 27 para. 9: the burden of proving the information was given is **on the
seller**.

### The resulting minimum set of fields on the site

| Field                                              | Basis                             |
| -------------------------------------------------- | --------------------------------- |
| Poslovno ime (full)                                | ZoT 32/1, ZZP 12/1/2, ZET 6/1     |
| Matični broj (MB)                                  | ZoT 32/1, ZZP 12/1/2, ZET 6/4     |
| PIB                                                | ZET 6/7                           |
| VAT number (if VAT registered)                     | ZET 6/7                           |
| Adresa sedišta                                     | ZoT 32/1, ZZP 12/1/2, ZET 6/2     |
| The shop's address (if different from the sedište) | ZoT 32/3, ZZP 27/1/1              |
| Phone                                              | ZZP 12/1/2                        |
| Email                                              | ZET 6/3, ZZP 27/1/1               |
| Supervisory body                                   | ZET 6/5                           |
| The shop's opening hours                           | ZoT 33 (at the point of sale) [P] |

Separately, **Zakon o trgovini član 34** [P]: in distance selling the seller must
display a **declaration** and make its details available to the buyer **before the
purchase**, «u obliku i na način koji je neposredno i stalno dostupan». The
declaration's contents (art. 34 para. 1): the name and kind of goods, the type and
model, the quantity in units of measure or pieces, the **poslovno ime proizvođača**,
and for imported goods the **poslovno ime uvoznika i zemlja proizvodnje**. All of it
«na srpskom jeziku, na ćiriličkom ili latiničkom pismu». This is a requirement on
the product card, not on the footer — for car parts it means the manufacturer, the
country of origin and the importer on every item.

Art. 34 para. 8 adds: the goods must be marked with a machine-readable identifier
(GTIN, QR and so on). [P] — whether that applies to a website's listing rather than
to physical packaging is **[NOT ESTABLISHED]**.

## 2. Is a "Uslovi prodaje" / "Povraćaj" page required

**The short answer: nowhere does the law say "publish a page with this name". But
the set of mandatory information is such that there is physically nowhere to put it
without a dedicated page (or several). Individual pieces of it are explicitly
required to be displayed on the site.**

What is tied explicitly to the site:

- **ZZP 35/2026, član 63 st. 4** [P]: «Trgovac je dužan da na prodajnom mestu **i
  internet stranici (u slučaju daljinske trgovine)** vidno istakne obaveštenje o
  **načinu i mestu prijema reklamacija**, kao i da obezbedi prisustvo lica
  ovlašćenog za prijem reklamacija u toku radnog vremena.» — a direct, unconditional
  requirement to have a complaints block on the site.
- **ZZP 35/2026, član 32 st. 7** [P]: «Na prodajnim internet stranicama, **najkasnije
  na početku postupka naručivanja**, moraju da budu jasno i čitko navedeni podaci o
  postojanju **ograničenja u pogledu isporuke** i **koja sredstva plaćanja se
  prihvataju**.» — for our shop that is "no delivery, pickup only; payment in cash or
  by card at the shop", and it must be visible **before the ordering process starts**,
  not only in the terms.
- **ZET, član 12** [P]: before the contract is concluded, provide details of (1) how
  the contract is concluded, (2) the contractual provisions, (3) the **opšti uslovi
  poslovanja, if they form part of the contract**, (4) the languages the contract can
  be concluded in, (5) codes of conduct. Plus para. 2 — **technical means of
  identifying and correcting input errors** before the order is sent.
- **ZET, član 13** [P]: «Pružalac usluga dužan je da obezbedi da **tekst ugovora i
  odredbe opštih uslova poslovanja** koje su sastavni deo ugovora zaključenih u
  elektronskom obliku budu dostupni korisnicima usluga **na način koji omogućava
  njihovo skladištenje, ponovno korišćenje i reprodukovanje**.» — the text of the
  terms has to be storable (an ordinary page plus the ability to save or print to PDF
  satisfies this; a modal that cannot be saved does not).
- **ZET, član 14** [P]: the seller must, **without delay and by a separate electronic
  message, confirm receipt** of the electronic message containing the offer or its
  acceptance. So an order confirmation email is mandatory.

What has to be in the text (ZZP 12 and 27, the full list):

art. 12 para. 1 — the goods' main characteristics; the seller's details; the
**selling price or how it is calculated**, plus any additional postal or transport
costs and the possibility of charging them to the buyer; the **means of payment, and
the manner and deadline for performance**; the **existence of statutory liability
for non-conformity (saobraznost)**; the **procedure for filing a complaint, the
place of receipt and the seller's course of action, and the conditions for
exercising saobraznost rights**; the **availability of spare parts, consumables,
technical service, maintenance and repair** during and after the non-conformity
liability period — **when offering and selling technical goods**; the conditions for
terminating an open-ended or auto-renewing contract; the **availability of
out-of-court dispute resolution**.

art. 12 para. 2 (as applicable) — the contract's duration, the minimum term of
obligations, the functionality and compatibility of goods with digital elements, the
**existence and conditions of after-sales services and commercial guarantees**.

art. 27 para. 1 — the geographic address, email, means of communication that
preserve the correspondence; the price per billing period for open-ended or
subscription contracts; the cost of the means of communication where the tariff is
non-standard; the **conditions, deadline and procedure for exercising the right of
withdrawal (art. 29)**; the obligation to pay reasonable costs under art. 36 para. 3
when withdrawing after a service has begun; **information that there is no right of
withdrawal, or in what circumstances it is lost (art. 38)**; the existence of a
contract with a postal operator through which the buyer may send goods back **at the
seller's expense** when complaining; the availability of out-of-court dispute
resolution.

art. 27 para. 2 — the buyer's obligation to bear the cost of return on withdrawal
(and, where the goods by their nature cannot be returned by post, the cost of
return); codes; the minimum term of obligations; deposits and financial guarantees;
**whether the price was personalised by an automated decision-making system**.

**The sanction for failing to inform, ZZP 12 para. 7** [P]: the buyer may demand
**annulment of the contract (poništaj)** regardless of whether the seller intended
to mislead; the right lapses a year after the contract was concluded.

**Conclusion:** the page is mandatory by content, not by name. A practical layout is
"Uslovi prodaje" (the mandatory details, how to order, price, payment, pickup, the
right of withdrawal, saobraznost, guarantee, out-of-court dispute resolution) plus
"Reklamacije" (the manner and place of receipt, the deadlines) plus the withdrawal
form. The law does not dictate the pages' Serbian names, **but the text must be in
Serbian** (ZZP 12 para. 1 and 27 para. 7). [P]

## 3. The 14-day right of withdrawal on pickup — the subtlest question

### What is certain [P]

- **ZZP 35/2026, član 29 st. 1**: «Potrošač ima pravo da odustane od ugovora
  zaključenog **na daljinu ili izvan poslovnih prostorija** u roku od 14 dana bez
  navođenja razloga i bez dodatnih troškova, osim troškova iz čl. 35. i 36.»
- **ZZP 35/2026, član 5 t. 7** — the definition of a distance contract: «ugovor
  zaključen između trgovca i potrošača u okviru organizovane prodaje ili pružanja
  usluga na daljinu **bez istovremenog fizičkog prisustva** trgovca i potrošača,
  **isključivom upotrebom** jednog ili više sredstava komunikacije na daljinu **do
  trenutka zaključenja ugovora, uključujući i sam trenutak zaključenja**».
- **ZZP 35/2026, član 30 st. 2**: for a contract of sale, the 14 days run «od dana
  kada roba **dospe u državinu potrošača**» — so with pickup the clock starts **on
  the day the buyer collected the goods**, not on the day of the order.
- **ZZP 35/2026, član 38** — the closed list of exemptions from the right of
  withdrawal. **Car parts are not on it.** Neither is "the goods were collected in
  the shop". Of the thirteen items, only item 3 (goods made to the buyer's
  specification or clearly personalised) and item 5 (sealed goods that cannot be
  returned for health or hygiene reasons, once opened after delivery) are even
  potentially relevant — and neither applies to an ordinary part off the shelf.
- **ZZP 35/2026, član 30 st. 6**: if the seller did not hand over the notice of the
  right of withdrawal (art. 27 para. 1 item 4) in the manner of art. 31 para. 1 /
  art. 32 para. 2, the buyer may withdraw **within 12 months** after the ordinary
  period expires.
- **ZZP 35/2026, član 32 st. 2**: within a reasonable time after the contract is
  concluded, and no later than the moment of delivery, hand the buyer, on a trajni
  nosač podataka, (1) the **withdrawal form**, (2) the art. 27 information in
  Serbian, and (3) the contract or a document evidencing it.
- **ZZP 35/2026, član 32 st. 5**: if submitting the order simultaneously means
  accepting an obligation to pay, there must be an **explicit notice on the order
  form or on the button**. Para. 6: if the seller failed to do that, **the contract
  or the buyer's order does not bind them**.

### What is not established [NOT ESTABLISHED]

**Whether "ordered online, collected and paid for in the shop" is a distance
contract under Serbian law — I found no direct answer in a Serbian primary source.**
Neither ZZP 35/2026, nor Zakon o trgovini, nor Zakon o elektronskoj trgovini
contains a rule about click-and-collect. Serbian statutes are published without
preambles or recitals, so there is no interpretative text inside the act. I found no
case law and no ministry guidance on the question. Industry analyses (Paragraf's
"Vodič za e-trgovinu", law-firm write-ups) **do not touch pickup at all** — they only
discuss delivery.

The question reduces to **where the contract is concluded**:

- **ZET, član 15** [P]: «Ugovor u elektronskom obliku smatra se zaključenim onog
  časa kada **ponuđač primi elektronsku poruku koja sadrži izjavu ponuđenog da
  prihvata ponudu**.» If the product card is the offer and the online order is the
  acceptance, the contract is concluded when the shop receives the order, at a
  distance. If the online order is the buyer's offer, the contract is concluded when
  the shop's acceptance becomes available to the buyer — and if that acceptance is
  electronic (a confirmation email), it is **also at a distance**.
- The only way to take the transaction out of the distance category is to make the
  online form a **reservation without acceptance**, where the contract is genuinely
  concluded at the counter. But then the confirmation email must not be an
  acceptance, and the goods in the shop must not already be "sold".

**An analogy from EU law** (the Serbian ZZP transposes Directive 2011/83/EU; the
wording of ZZP art. 5 item 7 matches Art. 2(7) of the Directive in substance).
Recital 20 of Directive 2011/83/EU, **read verbatim** [P, but the source is EU law,
not Serbian]:

> «By contrast, a contract which is negotiated at the business premises of the
> trader and finally concluded by means of distance communication should not be
> considered a distance contract. **Neither should a contract initiated by means of
> distance communication, but finally concluded at the business premises of the
> trader be considered a distance contract.** Similarly, the concept of distance
> contract should not include reservations made by a consumer through a means of
> distance communications to request the provision of a service from a
> professional…»

So by EU logic: a contract **initiated** at a distance but **finally concluded** on
the trader's premises is **not** a distance contract, and there is no statutory right
of withdrawal. But: (a) Serbian law contains no recitals and is not formally bound by
them; (b) it depends on how the site's funnel actually works, not on what the terms
say.

### The practical conclusion

The safe option is to **grant the 14 days and describe them**, whatever the legal
classification:

1. The cost of being wrong is asymmetric. If the shop gave no notice of the right of
   withdrawal and the transaction turns out to be a distance one, the withdrawal
   period stretches to **12 months plus 14 days** (art. 30 para. 6), and the burden
   of proving the notice was given lies on the seller (art. 27 para. 9). Whereas if
   the shop granted more rights than the law demands, there is no infringement.
2. The clock runs from the moment the buyer collected the goods anyway (art. 30
   para. 2), so for pickup the period starts in the shop.
3. The opposite option — stating in the terms that "this is pickup, the contract is
   concluded in the shop, and the art. 29 right of withdrawal does not apply" — is
   arguable, but it requires the funnel to genuinely be a reservation, and **it is a
   position to agree with a Serbian lawyer**. Text in the terms does not by itself
   change how the transaction is classified.

What the site needs in any case if the shop recognises the right of withdrawal: the
information under art. 27 para. 1 items 4 and 6, the withdrawal form (art. 32
para. 2 item 1), and an order button that explicitly states the «obaveza plaćanja»
(art. 32 para. 5).

### The withdrawal form

**Pravilnik o obliku i sadržini obrasca za odustanak od ugovora na daljinu ili
ugovora koji se zaključuje izvan poslovnih prostorija** — the current number is
**«Sl. glasnik RS», br. 21/2022** (confirmed from the list of secondary instruments
on the ministry's site, must.gov.rs). [S — the number comes from the ministry's
official register, but I could not read the text of the pravilnik itself]

Under art. 217 of ZZP 35/2026 [P], secondary instruments adopted before the act came
into force continue to apply until new ones are adopted, unless they contradict the
act. Under art. 29 para. 8 the minister prescribes the form; art. 216 allows a year
for adopting the new secondary instruments.

The **previous** pravilnik was read verbatim (21/2015, made under ZZP 62/14) [P].
Its art. 2 requires the form to contain:

1. naziv, adresu, broj telefona, broj faksa i elektronsku poštu trgovca;
2. the buyer's statement of withdrawal;
3. the date the contract was concluded;
4. the date the goods were received;
5. the reasons for withdrawal — **with a note that the buyer is not obliged to state
   them**;
6. the buyer's first name, last name and address;
7. the buyer's handwritten signature, if the form is submitted by post or fax;
8. the date the form was filled in.

**[NOT ESTABLISHED]**: whether that list matches the 21/2022 edition. Check against
the text of 21/2022 before publishing the form.

## 4. Price: with or without VAT, in dinars

### Zakon o trgovini, član 35 [P] — the governing provision

The paragraph numbers below were derived **by counting paragraphs in the
consolidated text** (I downloaded the whole article and recounted), not taken from
somebody's summary. They agree with what Paragraf and Lexarhiva cite independently.
But before printing a paragraph number on a legal page, it is better to check
against the «Službeni glasnik»: the article number (35) is reliable, the paragraph
numbers are derived.

- Para. 1: «Trgovac je dužan da na jasan, nesumnjiv, lako uočljiv i čitljiv način
  istakne **prodajnu cenu, kao i jediničnu cenu gde je primenljivo**, na robi
  odnosno ambalaži, neposredno pored robe ili **u slučaju daljinske trgovine
  neposredno pored prikaza ili opisa robe**.» — so the price must sit **next to the
  product's image or description**, not only in the cart.
- Para. 3: «**Prodajna cena je konačna cena po jedinici robe, uključujući poreze i
  dažbine.**» — the price is **with VAT** and final. Showing a "price excluding VAT"
  as the primary price is not allowed.
- Para. 8: «Jedinična cena jeste **konačna cena, uključujući i porez**, po jedinici
  mere…»
- Para. 7: the unit price must be shown for **pre-packaged goods** (prethodno
  upakovana roba). Para. 9: if the unit price equals the selling price, it does not
  need stating separately. Para. 10: the minister further prescribes which kinds of
  goods carry a unit price.

**Pravilnik o vrsti robe za koju se ističe jedinična cena i načinu isticanja
(«Sl. glasnik RS», br. 39/2021)** — read verbatim from the «Službeni glasnik» text
[P]. Art. 2 para. 1, the full list: 1) hrana i hrana za životinje; 2) alkoholna i
bezalkoholna pića i sokovi; 3) voda; 4) deterdženti; 5) boje i lakovi, izuzev
slikarskih boja; **6) ulje, maziva i druge tečnosti za motore i motorna vozila**; 7) destilovana voda; 8) proizvodi za pranje, čišćenje i negu lica i tela; 9) proizvodi za pranje i negu kose; 10) proizvodi za pranje, čišćenje i negu zuba i
usne šupljine. Para. 2 lists the exceptions: gift sets and bundles; fruit and
vegetables sold by the piece or in bunches.

Art. 4: «Jedinična cena se ističe na jasan, lako uočljiv i čitljiv način **sa
naznakom jedinice mere u kojoj je iskazana (din/jedinica mere)**.» Art. 3: for goods
of the same kind at one point of sale, the unit price is expressed in the same units
of measure.

→ **The concrete consequence for a car parts shop:** mechanical parts (pads, discs,
filters, bearings) are **absent** from the list — no unit price needed. But **motor
oils, lubricants, antifreeze, brake fluid, washer fluid and distilled water** fall
squarely under items 6 and 7 — for them **a price per litre in `din/l` form next to
the selling price is mandatory**.

- Para. 12: «Trgovac je dužan da **ukoliko oglašava prodajnu cenu robe, navede i
  jediničnu cenu robe**.»
- Para. 14: «**Cena se ističe u dinarima.**»
- Para. 15 (the exception): a seller conducting electronic commerce aimed
  simultaneously at consumers in Serbia and abroad **may** show the price in a
  foreign currency too, with a currency selector covering **the whole** range; but a
  buyer arriving **from Serbia must be shown the price in dinars first**.
- Para. 16: a foreign currency only is permitted in narrow cases (tourism connected
  with abroad; **vehicles**; where the foreign exchange act permits payment in
  foreign currency; where the electronic commerce is not aimed at consumers in
  Serbia). Para. 17: in that case the conversion rate must be stated — the NBS's
  official middle rate for the dinar.
  → **Car parts are not «vozila»**, so a EUR-only price tag is not permissible for
  our shop. Showing EUR alongside RSD is possible under para. 15, but dinars must
  come first and the selector must cover the whole range.

### Zakon o zaštiti potrošača 35/2026, član 6 [P]

- Para. 1: «Trgovac je dužan da… na nedvosmislen, čitak i lako uočljiv način istakne
  prodajnu i jediničnu cenu robe ili usluge, **u skladu sa propisima kojima se
  uređuje trgovina**.» — i.e. a reference back to ZoT 35.
- Paras. 2–7: the obligation to publish on one's own site, **separately for each
  retail outlet**, a price list in a digital form suitable for automated processing;
  to update it in real time; to abide by the published prices; not to obstruct
  price-comparison crawlers; and to **open an account on the National Open Data
  Portal** and update the price list on every price change. Art. 6 applies from
  **2026-05-01**.

**However:** the secondary instrument that defines who is caught —
**Pravilnik o uslovima, sadržaju i načinu objavljivanja cenovnika («Sl. glasnik RS»,
br. 76/2026)** — applies from **2026-09-01**, and the obligation under it extends
only to retailers who **cumulatively** (a) trade in goods from 25 prescribed groups
(dairy, drinks, coffee/tea, fruit and vegetables, bread, meat and fish,
confectionery, flour, pasta, oils, household chemicals, hygiene and cosmetics, baby
food, nappies, alcohol, pet food and so on) **and** (b) had revenue from sales
**above 3 billion dinars** in the last business year. [S — a summary by the law firm
PR Legal plus the press; I did not read the text of pravilnik 76/2026 itself]

→ **A car parts shop is not caught by this obligation** — neither by product
category nor by the revenue threshold. The obligation under art. 6 para. 1 (a
visible price with VAT, in dinars, on every product) remains in full force.

**[NOT ESTABLISHED]**: the exact text of pravilnik 76/2026, and whether it widens the
circle of obliged traders on any additional ground.

### Zakon o elektronskoj trgovini, član 6 st. 2 [P]

If the seller states prices, it must be **explicitly stated whether they include
delivery costs, other handling costs, tax and other costs**. For our shop: say
plainly that the price includes VAT and that there is no delivery (and therefore no
delivery cost).

### Discounts and the «najniža cena u poslednjih 30 dana» rule

**Zakon o trgovini, član 36** [P] — an offer of a sales incentive must state the kind
of incentive, an exact definition of the goods, the **period of validity with start
and end dates** (for a clearance sale, with the note «dok traju zalihe»), and any
special conditions. If the incentive covers goods of reduced consumer value (faulty,
damaged, close to expiry), the reason must be stated explicitly. A promotivna prodaja
(the first introduction of goods into the offering) lasts no more than 60 days.

**Zakon o trgovini, član 37** («Prodaja sa sniženom cenom») [P] — read in full. The
"lowest price in the last 30 days" rule is **not** in ZZP 35/2026 (verified by
grepping the whole text); it lives here.

- Kinds of reduction: `rasprodaja`, `sezonsko sniženje`, `akcijska prodaja`.
- «U slučaju prodaje robe/usluge sa sniženom cenom, trgovac… je dužan da pored
  ponude prodajnog podsticaja… na prodajnom mestu **jasno istakne i sniženu i
  prethodnu cenu**.»
- «**Prethodna cena je najniža cena po kojoj je trgovac nudio robu tokom perioda od
  30 dana pre početka sniženja cena**, osim za lako kvarljivu robu i robu sa kratkim
  rokom trajanja.»
- For goods that have been in the range for **fewer than 30 days**, the previous
  price is the lowest price over a period of **no less than 15 days** before the
  reduction started.
- If the price is reduced gradually and without interruption within one reduction,
  the previous price is the lowest of the 30 days before the reduction started.
- `Sezonsko sniženje` — no more than twice a year, starting in the periods
  25.12–10.01 and 1–15.07, lasting no more than 60 days.
- `Akcijska prodaja` — no longer than 31 days. **A promotion valid for up to three
  days need not show the reduced and previous price — a clearly stated percentage
  reduction is enough.**

→ In practice: any struck-through price tag on the site must carry a **previous price
= the lowest of the 30 days before the promotion started**, with start and end dates
(ZoT 36). The only lawful way to show a percentage alone is a promotion no longer
than three days.

## 5. The fiscal receipt

**The short answer: yes, a fiscal receipt is mandatory, printed, at the moment of
payment at the till. The order having been placed online changes nothing — the shop
is not a seller "exclusively over the internet".**

### The basis

**Zakon o fiskalizaciji, «Sl. glasnik RS», br. 153/2020, 96/2021, 138/2022,
80/2026.**

- **Član 3 st. 1** [P]: «Predmet fiskalizacije je promet dobra i usluga na malo… i
  primljeni avans za promet na malo.»
- **Član 3 st. 2** [P]: promet na malo is «svaki izvršen promet dobara i pružanje
  usluga **fizičkim licima**, kao i svaki promet dobara i usluga **u maloprodajnim
  objektima**, nezavisno od toga da li je korisnik fizičko lice, pravno lice ili
  preduzetnik…»
- **Član 3 st. 4** [P]: «Maloprodajnim objektom… smatra se svaki poslovni prostor i
  poslovna prostorija koji se primarno koriste za promet dobara i pružanje usluga
  fizičkim licima, **kao i sedište obveznika fiskalizacije koji vrši promet na malo
  preko interneta putem daljinske trgovine**.» — the act deliberately widens the
  notion of a retail outlet to cover pure internet sellers so they do not fall out of
  fiscalisation. There is no lighter regime for them.
- **Član 4 st. 2** [P]: «Obveznik fiskalizacije je u obavezi da evidentira svaki
  pojedinačno ostvareni promet na malo i to **nezavisno od načina plaćanja**
  (gotovinom, instant transferom odobrenja, čekom, platnom karticom, na drugi
  bezgotovinski način i sl.), uključujući i primljene avanse…, preko elektronskog
  fiskalnog uređaja.»
- **Član 6 st. 1** [P]: «Obveznik fiskalizacije dužan je da **u trenutku prometa na
  malo**… izda fiskalni račun korišćenjem elektronskog fiskalnog uređaja…»

Selling a part to a consumer in the shop for cash or by card is `promet na malo`
under art. 3 para. 2, so a receipt is mandatory.

### Printed or electronic

**Pravilnik o vrstama fiskalnih računa, tipovima transakcija, načinima plaćanja,
pozivanju na broj drugog dokumenta i pojedinostima ostalih elemenata fiskalnog
računa**, «Sl. glasnik RS», br. 31/2021, 99/2021, 10/2022, 49/2022, 50/2022,
57/2022. **Član 13**:

- para. 1 [P, against the original 31/2021 text]: the receipt is issued to the buyer
  **in printed form**, allowing the receipt to be verified;
- para. 2 [S — added by amendment, the verbatim text was not read]: the receipt
  **may** be delivered electronically, **exclusively with the buyer's consent**;
- para. 3 [P]: «Izuzetno od st. 1. i 2… obveznik fiskalizacije koji obavlja promet
  na malo **isključivo putem interneta**… fiskalni račun izdaje kupcu… u elektronskoj
  formi.»

**Our shop hands over goods and takes payment in a physical shop, so it is not
"isključivo putem interneta".** Therefore: by default, **a printed receipt at the
counter**. A PDF/QR email is permissible only **additionally, as a delivery method,
with the buyer's consent**, and does not replace the print.

### Which type of receipt

**Pravilnik 31/2021, član 2 and član 3** [P]:

- vrste računa: `Promet` and `Avans`;
- tipovi transakcija: `Prodaja` and `Refundacija, odnosno poništavanje računa`.

→ For our scenario: **vrsta = `Promet`, tip = `Prodaja`**.
→ On a return or exchange of a part: **`Promet` / `Refundacija`**, and **član 11
st. 1 t. 1** [P] requires the refund receipt to reference the unique sequence number
of the original sale receipt.

**Član 6** [P] — means of payment: `gotovina`, `instant plaćanje`, `platna kartica`,
`ček`, `prenos na račun`, `vaučer`, `drugo bezgotovinsko plaćanje`.
→ For us: `gotovina` or `platna kartica`.

**Član 10** [P] — a printed receipt carries a **QR code** (a square of 40×40 to
50×50 mm, with no logos or images); an electronically issued receipt carries a
**verification hyperlink**.

### If online prepayment ever appears

Then the prepayment is a `primljeni avans za budući promet na malo`, and at the
moment the advance is received a **`Račun za avans` / type `Prodaja`** is issued
(ZoF art. 3 para. 1 and art. 4 para. 2; Pravilnik art. 2 para. 3, art. 3 para. 2)
[P]. When the goods are handed over, a **`Račun za promet`** is issued, which must
**reference the advance receipt's sequence number** — Pravilnik **član 11 st. 1
t. 2** [P].

So adding online payment to the shop is not "just acquiring" — it is a second type of
fiscal document plus the link between them. Worth accounting for when planning.

### There is no exemption

**Uredba o određivanju delatnosti kod čijeg obavljanja ne postoji obaveza
evidentiranja prometa na malo preko elektronskog fiskalnog uređaja**, «Sl. glasnik
RS», br. 32/2021, 117/2021, 51/2022, 141/2022, 85/2023, 99/2024, 110/2025. Retail
trade in parts and accessories for motor vehicles (**code 45.32**) is **absent** from
the list of exempt activities. [S — confirmed by a direct query on paragraf.rs; the
full list in arts. 2 and 3 was not read verbatim]

### The equipment (context)

An `elektronski fiskalni uređaj` = **ESIR** (the receipt-issuing system) + **PFR**
(the fiscal receipt processor) + a **bezbednosni element** (a smart card with a
certificate). The PFR is either **L-PFR** (local, works offline) or **V-PFR**
(virtual, in the Tax Administration's system, requiring constant internet). Every
business premises must have at least one L-PFR — except for sellers operating
exclusively over the internet. [S — a paraphrase of ZoF art. 6 paras. 3–8, not read
verbatim]

### An important warning

A claim circulates in blogs that a Ministry of Finance position makes the question
turn on whether there is "direktan kontakt" between seller and online buyer, and that
goods ordered online and collected without an additional service can be treated as an
online sale and exempted from L-PFR. **I could not trace this to an opinion number
and date; it looks like doctrine from the repealed pre-fiscalisation regime (Zakon o
fiskalnim kasama). [NOT ESTABLISHED — do not rely on it.]** It also contradicts the
plain text of art. 3 para. 2.

Separately: **a fiscal receipt and a «račun» under ZZP član 11 are not the same thing
in their legal basis**, though in practice a fiscal receipt covers both. ZZP art. 11
[P] requires an invoice to contain the name or firm, address and identifying details
of the seller, details of the goods, the selling price, the date of issue, a
specification and the **total amount payable**; and in the same place: «Trgovac mora
da se pridržava istaknute cene i uslova prodaje. **Zabranjeno je naplaćivanje
izdavanja i slanja računa potrošaču.**»

## 6. Garancija versus saobraznost

These are two different institutions, and confusing them in the site's text is a
classic mistake.

### Saobraznost — statutory liability, always in force

**ZZP 35/2026, član 59 st. 1** [P]: «Trgovac je odgovoran za nesaobraznost robe
ugovoru koja se pojavi **u roku od dve godine od dana isporuke potrošaču**.»

- **art. 59 para. 3** [P]: if the non-conformity arises **within one year** of
  delivery, **it is presumed to have existed at the moment of delivery**, unless that
  contradicts the nature of the goods and the nature of the non-conformity; the
  burden of proving otherwise is on the seller. (In ZZP 88/2021 that presumption was
  six months — one of the headline changes of 2026.)
- **art. 59 para. 4** [P]: for **used** goods a **shorter period may be agreed, but
  not less than one year**. → For a shop selling used parts, that is the only lawful
  way to shorten the period, and it requires agreement rather than a unilateral
  declaration.
- **art. 59 para. 5** [P]: the periods do not run during the time the seller uses to
  remedy the non-conformity.
- **art. 59 para. 6** [P]: the buyer must notify the seller of the non-conformity
  **within two months** of becoming aware of it, and no later than two years from
  delivery.

**Remedies, art. 56** [P]: the buyer may demand the non-conformity be remedied **free
of charge — by repair or replacement** — or a proportionate price reduction, or
rescission of the contract. **Para. 2: the choice between repair and replacement
belongs to the buyer.** Para. 5: after the first repair, if the same or another
non-conformity appears, the buyer may demand replacement, a price reduction or
rescission, and a second repair is possible **only with the buyer's express
consent**.

**Art. 56 para. 7** [P] — an important novelty: «Ako se nesaobraznost pojavi **u roku
od 30 dana** od dana isporuke robe potrošaču, potrošač ima pravo da bira između
zahteva da se nesaobraznost otkloni **zamenom, odgovarajućim umanjenjem cene ili da
izjavi da raskida ugovor**.» (In 88/2021 that window was six months.)

**Art. 56 para. 8** [P]: remedying the non-conformity is **free** for the buyer; all
necessary costs — labour, materials, delivering the replacement and collecting the
item being replaced — fall on the seller.

**Art. 56 para. 9** [P]: the buyer cannot rescind the contract if the non-conformity
is **insignificant**; the burden of proving insignificance is on the seller.

### Komercijalna garancija — voluntary, and it cannot be declared empty

**ZZP 35/2026, član 61** [P]:

- para. 3: the seller must hand over a **garantni list** in written or electronic
  form, or on another durable medium, **no later than the moment of delivery**. The
  guarantee document must contain:
  1. **a clear statement that the buyer has rights under this act, that they are
     exercised free of charge, and that the commercial guarantee neither excludes nor
     affects the buyer's rights under the statutory liability for non-conformity**;
  2. the name and address of the guarantor;
  3. information on how to exercise the guarantee rights;
  4. details identifying the goods (model, type, serial number and so on);
  5. information about the conditions of the guarantee.
- para. 4: an electronic guarantee document requires **the buyer's consent**.
- para. 5: the burden of proving the guarantee document was handed over is on the
  seller.
- para. 1: if the terms of the guarantee issued are **less favourable** than those
  stated in advertising, the guarantor **is bound by the advertising**.
- para. 2: if the durability guarantor is the manufacturer, it is liable **directly
  to the buyer**.
- para. 7: «Komercijalna garancija **ne isključuje i ne utiče** na prava potrošača u
  vezi sa saobraznošću robe ugovoru.»

**Član 62** [P]: «…trgovac je dužan da se **uzdrži od upotrebe izraza "komercijalna
garancija"** i izraza s tim značenjem, ako po osnovu ugovora o prodaji potrošač ne
stiče **više prava** nego iz zakonske odgovornosti trgovca za nesaobraznost…» — so a
restatement of statutory rights may not be called a guarantee. The word `garancija`
is permissible on the site only if the shop genuinely gives more than the law does.

### What must be stated on the site

- **ZZP 12 para. 1 item 5** [P]: the existence of **statutory liability for
  non-conformity** of goods, services, digital content and digital services with the
  contract.
- **ZZP 12 para. 1 item 6** [P]: the **procedure for filing a complaint**, in
  particular the place of receipt and the seller's course of action, and the
  conditions for exercising saobraznost rights.
- **ZZP 12 para. 1 item 7** [P]: the **availability of spare parts, consumables,
  attachable devices and similar parts, technical service or maintenance and repair**
  during and after the non-conformity liability period — when offering and selling
  **technical goods**.
- **ZZP 12 para. 2 item 5** [P]: the **existence and conditions of after-sales
  services and commercial guarantees**.

### "Tehnička roba" — an important nuance for car parts

**ZZP 35/2026, član 5 t. 41** [P]: «tehnička roba je složena stvar, odnosno uređaj
industrijske proizvodnje trajnije upotrebe (aparati za domaćinstvo, kompjuteri,
telefoni, **motorna vozila** i sl.) **za čiji je rad neophodna električna energija,
drugo sredstvo napajanja (npr. baterija ili akumulator) ili motor na unutrašnje
sagorevanje**.»

So the definition turns on whether **the item itself** needs power to work. A car
parts range splits in two:

- probably **tehnička roba**: a battery, starter, alternator, sensors, ECU, electric
  motors, heaters;
- probably **not**: a brake disc, pads, a filter, oil, a belt, a bearing, a bush.

The practical consequence is **ZZP 63 para. 9** [P]: the deadline for resolving a
complaint cannot exceed **15 days, or 30 days for technical goods and furniture**,
from the day it was filed. Plus the art. 12 para. 1 item 7 requirement about spare
parts and service is tied to technical goods.

**[NOT ESTABLISHED]**: how the supervisory authority classifies a specific part (a
battery, say, or a xenon bulb). I found no guidance or practice on that boundary. The
safe course is to state the law's own wording — "15 days, and 30 days for technical
goods" — rather than to claim 30 days across the range: giving yourself 30 days where
the law gives 15 worsens the consumer's position and is **not allowed**.

### Complaints: the full set of duties (ZZP član 63) [P]

- para. 3: the seller **must accept** a complaint that is filed. **Charging for
  establishing non-conformity is forbidden.**
- para. 4: **display, at the point of sale and on the website (in the case of
  distance selling), a visible notice of the manner and place of receiving
  complaints**, and ensure an authorised person is present during working hours.
- para. 5: a complaint may be filed **orally at the point of sale, by phone, in
  writing, electronically or on a durable medium**, presenting the invoice or other
  proof of purchase (a copy of the invoice, a slip and so on).
- para. 6: keep an **evidencija primljenih reklamacija** and retain it for **at least
  two years**.
- para. 7: **issue written or electronic confirmation of receipt without delay**, i.e.
  communicate the register number.
- para. 8: the register's contents (the filer's first and last name, the date of
  receipt, details of the goods, a short description of the non-conformity and the
  demand, the date the confirmation was issued, the decision, the date the decision
  was delivered, the agreed deadline, the manner and date of resolution, details of
  any extension).
- para. 9: **reply no later than 8 days** from receipt, in writing or electronically;
  the reply must contain the decision (accepted or not), the grounds for refusal, a
  response to the buyer's demand, and a concrete proposal as to the deadline and
  manner. **The resolution deadline is no more than 15 days, or 30 for technical
  goods and furniture.**
- para. 10: the resolution deadline is **suspended** when the buyer receives the
  reply and resumes when the seller receives the buyer's response; the buyer must
  respond **within three days**; the seller must expressly notify them in the reply
  of that duty, of the consequences of missing it and of the suspension of the
  deadlines; silence counts as disagreement.
- para. 11: the deadline may be extended **only once**, with notice to and the
  consent of the buyer, and a note in the register.
- para. 12: on **refusing** a complaint, inform the buyer about out-of-court dispute
  resolution and the competent bodies.
- para. 13: **the inability to produce the packaging may not be a condition of
  resolving a complaint or a ground for refusing it.** ← an outright ban on "no box,
  no return".

## 7. What this means for the site: a checklist of fields and texts

Seller details (footer plus a dedicated page, permanently available):

- [ ] Poslovno ime, matični broj, PIB, VAT number (if applicable)
- [ ] Adresa sedišta; the shop's address; phone; email
- [ ] Supervisory body
- [ ] The shop's opening hours

The product card:

- [ ] Prodajna cena **in dinars, with VAT**, next to the image or description
- [ ] Jedinična cena (din/unit) — **mandatory for oils, lubricants and other fluids
      for engines and vehicles**; not needed for mechanical parts
- [ ] On a discount — **both the reduced and the previous price** (the lowest of 30
      days)
- [ ] The declaration: name and kind, type/model, quantity, manufacturer; for
      imports, the importer and country of origin; in Serbian

The ordering process:

- [ ] **Before ordering begins** — plainly: "no delivery, pickup only" and which
      means of payment are accepted (ZZP 32 para. 7)
- [ ] An order button explicitly stating the **obligation to pay** (ZZP 32 para. 5) —
      otherwise the buyer's order does not bind them (para. 6)
- [ ] A technical means of correcting input errors before submission (ZET 12 para. 2)
- [ ] An **automatic confirmation email** acknowledging the order (ZET 14)

The terms page (text in Serbian):

- [ ] The full set under ZZP 12 and 27
- [ ] The 14-day right of withdrawal plus the procedure and the form, or a reasoned
      position to the contrary (see section 3 — decide with a lawyer)
- [ ] Saobraznost: 2 years, a 1-year presumption, a 30-day window to choose
      replacement / reduction / rescission, and the procedure
- [ ] A commercial guarantee — only if something genuinely beyond the law is given
      (ZZP 62)
- [ ] Out-of-court dispute resolution: mention that it exists and which bodies
- [ ] The terms text must be storable (ZET 13) — an ordinary page suffices

The complaints page (separate and visible, ZZP 63 para. 4):

- [ ] The manner and place of receiving complaints
- [ ] The deadlines: reply within 8 days, resolution within 15 (30 for technical
      goods)
- [ ] Plainly: packaging is not required, and establishing non-conformity is free

In the shop:

- [ ] A printed fiscal receipt with a QR code on every sale

## 8. What remains unverified

1. **How click-and-collect is classified under Serbian law** — the main open
   question. There is no Serbian primary source and no guidance.
2. **The text of Pravilnik 21/2022** (the withdrawal form) — only the 21/2015 edition
   was read.
3. **The full list of exemptions** in Uredba 32/2021 — only the negative answer for
   code 45.32 was confirmed.
4. **Pravilnik 76/2026** (the digital price list) — only a law firm's summary was
   read; the 3-billion-dinar threshold and the 25 categories were not checked
   against the text.
5. **Zakon o fiskalizaciji, član 6 st. 3–8** (L-PFR/V-PFR) — paraphrase only.
6. **Pravilnik 31/2021, član 13 st. 2** (electronic delivery of the receipt with
   consent) — the amendment's text was not read verbatim.
7. **Zakon o deviznom poslovanju** — the article about payment in dinars in domestic
   retail was not checked.
8. Classifying specific car parts as "tehnička roba".
9. Paragraph numbering in **Zakon o trgovini član 37**: in the current edition, by my
   reading, the seasonal reduction falls in para. 8, yet the act in the following
   paragraph refers to it as "stav 5" — it looks as though amendment 35/2026 inserted
   new paragraphs without fixing the internal reference. Check against the «Službeni
   glasnik» before citing art. 37's paragraph numbers.

## Sources

Primary sources (the text of the act or instrument was read):

- Zakon o zaštiti potrošača («Sl. glasnik RS», br. 35/2026), full text —
  https://www.prizma.rs/media/wysiwyg/manual/ZAKON-O-ZASTITI-POTROSACA-2026.pdf
- Zakon o trgovini («Sl. glasnik RS», br. 52/2019 i 35/2026) —
  https://www.paragraf.rs/propisi/zakon_o_trgovini.html
- Zakon o elektronskoj trgovini («Sl. glasnik RS», br. 41/2009, 95/2013 i 52/2019) —
  https://www.paragraf.rs/propisi/zakon_o_elektronskoj_trgovini.html
- Zakon o fiskalizaciji («Sl. glasnik RS», br. 153/2020, 96/2021, 138/2022, 80/2026) —
  https://propisi.net/zakon-o-fiskalizaciji/ and
  https://www.paragraf.rs/propisi/zakon-o-fiskalizaciji-republike-srbije.html
- Pravilnik o vrstama fiskalnih računa, tipovima transakcija… («Sl. glasnik RS»,
  br. 31/2021 and later), the original 31/2021 text —
  https://www.efiskal.rs/wp-content/uploads/2022/01/PRAVILNIK-O-VRSTAMA-FISKALNIH-RACUNA-I-TIPOVIMA-TRANSAKCIJA.pdf
- Pravilnik o vrsti robe za koju se ističe jedinična cena i načinu isticanja
  («Sl. glasnik RS», br. 39/2021), the «Službeni glasnik» text —
  http://demo.paragraf.rs/demo/combined/Old/t/t2021_04/SG_039_2021_005.htm
- Pravilnik o obliku i sadržini obrasca za odustanak… (the 21/2015 edition) —
  https://www.zastitapotrosaca.gov.rs/Portals/0/Resources/Pravilnik%20o%20obliku%20i%20sadrzini%20obrasca%20za%20odustanak%20od%20ugovora%20na%20daljinu%20i%20ugovora%20koji%20se%20zakljucuje%20iz.pdf
- Directive 2011/83/EU, Recital 20 (an interpretative analogy, not Serbian law) —
  https://www.legislation.gov.uk/eudr/2011/83/adopted/data.html
- Zakon o zaštiti potrošača 88/2021 (repealed, for checking the numbering) —
  https://www.parlament.gov.rs/upload/archive/files/lat/pdf/zakoni/2021/1290-21-lat.pdf

Official government pages:

- The list of secondary instruments of the Ministry of Internal and Foreign Trade —
  https://must.gov.rs/tekst/sr/410/podzakonski-akti.php
- Ministarstvo finansija, the consolidated Zakon o fiskalizaciji —
  https://mfin.gov.rs/sr/propisi-1/
- Uredba o određivanju delatnosti… (the list of amendments) —
  https://www.paragraf.rs/propisi/uredba-o-odredjivanju-delatnosti-nema-promet-preko-fiskalne-kase.html

Secondary sources:

- Vodič za e-trgovce (the Ministry + USAID + the E-commerce Association of Serbia) —
  https://ras.gov.rs/uploads/2017/01/vodic-za-e-trgovce.pdf (compiled before ZZP
  35/2026, so the article numbering is out of date)
- Paragraf, Vodič za e-trgovinu, post-sale obligations —
  https://www.paragraf.rs/baza-znanja/elektronsko-poslovanje/postprodajne-obaveze-trgovaca-na-internetu.html
- PR Legal, on Pravilnik 76/2026 (the digital price list) —
  https://www.prlegal.rs/sr/objavljivanje-cenovnika-trgovaca-ko-ima-novu-obavezu-i-sta-ona-podrazumeva/
- IPC, on the ZZP provisions applying from 2026-05-01 —
  https://www.ipc.rs/vest/novi-zakon-o-zastiti-potrosaca-odredbe-koje-se-primenjuju-od-1-maja-2026-godine_v2452
- Lexarhiva, Zakon o trgovini 35/2026 —
  https://lexarhiva.rs/propisi/zakon-o-trgovini-35-2026
- Statt.rs, on the 2026 amendments to the Zakon o trgovini —
  https://statt.rs/sr/izmene-zakona-o-trgovini-2026/
- Poreska uprava on the fiscalisation of internet trade (2022-10-20) —
  https://www.paragraf.rs/dnevne-vesti/241022/241022-vest6.html
