# Autotek: is there an API, and can we integrate with it?

Research date: **2026-10-16**. Question from the owner: the CarLab garage may run
AutoTEK (https://www.autotek.rs), a Serbian auto-service management program. Does
it have an API, and could carlab.rs (Astro sites, Medusa shop, Telegram lead CRM)
integrate with it: push leads, appointments or work orders in, and pull work
orders, client and vehicle records, parts and stock, prices or service history
out?

## Source status

- **[P]** first-party: autotek.rs pages fetched in this session (all 28 pages in
  its `sitemap1.xml` and menu), regos.rs (the maker), the AutoTEK Google Play
  listing.
- **[S]** secondary: web search result summaries, third-party sites.
- **[G]** general knowledge about Serbian e-invoicing, checked against the
  official efaktura.gov.rs pages linked where cited.
- **[UNKNOWN]** not documented anywhere I could reach. Ask the vendor.

---

## Verdict first

1. **No public API is documented.** Not on any of the 28 pages of autotek.rs,
   not in search results, not on GitHub. The URLs `/api`, `/cenovnik`,
   `/cene`, `/paketi`, `/download` and `/uslovi-koriscenja` all return the
   IIS "resource ... removed" 404. [P] There is no developer section, no terms
   of use page and no price list on the site.
2. **The only documented outbound integration is to accounting software**:
   "AutoTek pruža mogućnost integracije sa postojećim knjigovodstvenim
   softverima", with Pantheon as the example, where "svi računi i ostali
   dokumenti izrađeni u AutoTEK-u prenose direktno u Pantheon".
   ([/integracije](https://www.autotek.rs/integracije)) [P] So the vendor can
   and does move documents out of AutoTEK into third-party systems. How (file,
   database, web service) is not documented.
3. **It is an installed program, not a cloud app.** The site talks about
   installation ("Obuka i instalacija se ne naplaćuju"), remote support via
   TeamViewer/AnyDesk, "direktnim pristupom računaru", and photos that "ne
   zauzimaju mesto na Vašim računarima". [P] The database engine is not
   documented. The sister product RegOs, from the same company and address,
   says its database is "u Vašem vlasništvu, na proizvoljnom računaru u Vašem
   poslovnom prostoru" ([regos.rs/baza-podataka](https://www.regos.rs/baza-podataka)),
   which suggests but does not prove AutoTEK works the same way. [P, inference]
4. **Realistic path: ask the vendor.** They already build a per-customer
   Pantheon bridge, so a custom export or a small feed for one garage is a
   plausible commercial ask. Everything else (direct DB reads, UI automation)
   is a fallback with real risk. The SEF e-invoice channel exists but only
   carries B2B invoices, which is the wrong data for a retail garage.

---

## What AutoTEK is

- Desktop management program for car services, by **Regos d.o.o.**, Miće
  Popovića 18, 21203 Novi Sad-Veternik. "AutoTek program je proizvod iz palete
  kompanije Regos d.o.o." ([/o-nama](https://www.autotek.rs/o-nama)) [P]
- Claims "Preko 1000 zadovoljnih klijenata", 15-day free trial, free
  installation and training, automatic free updates
  ([home](https://www.autotek.rs/),
  [/azuriranje-programa](https://www.autotek.rs/azuriranje-programa)). [P]
- Site runs on ASP.NET 4 / IIS behind Azure ARR (response headers
  `X-AspNet-Version: 4.0.30319`, `ARRAffinity` cookie). [P] This says nothing
  certain about the desktop app's stack.
- Pricing: **not documented** on the site. [P]

### Modules (all from the feature pages linked in the left menu of [/opcije-programa](https://www.autotek.rs/opcije-programa)) [P]

| Area                  | What the site says it holds                                                                                                                       | Page                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Vehicles              | Vehicle card: owner, driver contacts, work orders, documents, reminders, e-knjižica, warranty, full history of installed parts                    | [/evidencija-vozila-u-programu](https://www.autotek.rs/evidencija-vozila-u-programu)            |
| Clients and suppliers | Legal and private persons, fleet, work orders, invoices, financial card and balance                                                               | [/stranke-i-dobavljaci](https://www.autotek.rs/stranke-i-dobavljaci)                            |
| Work orders           | Service type, status ("vozilo primljeno, pregledano, čeka na delove"), parts, services, photos, links to booking, quote and invoices              | [/radni-nalog-u-programu](https://www.autotek.rs/radni-nalog-u-programu)                        |
| Booking calendar      | Per bay and per mechanic; recognises client and vehicle from the plate                                                                            | [/kalendar-zakazanih-radova](https://www.autotek.rs/kalendar-zakazanih-radova)                  |
| Stock and accounting  | Unlimited warehouses, stock lists, price calculation and levelling, KEP/KPR/KIR, reservations, bank statement **import**                          | [/robno-knjigovodstvo-...](https://www.autotek.rs/robno-knjigovodstvo-magacini-i-stanje-lagera) |
| Invoicing             | Pro forma, invoices, advance, SEF e-invoices, fiscal receipts                                                                                     | [/izdavanje-racuna](https://www.autotek.rs/izdavanje-racuna)                                    |
| Fiscalisation         | Certified by the Tax Administration as ESIR in December 2021                                                                                      | [/e-fiskalizacija](https://www.autotek.rs/e-fiskalizacija)                                      |
| SEF                   | Create, send, receive, track status, sync with SEF; stock-in from an incoming e-invoice                                                           | [/efakture](https://www.autotek.rs/efakture)                                                    |
| Supplier e-invoices   | Invoices or delivery notes from "vodećim dobavljačima auto delova" land in the program and update stock                                           | [/e-racuni-dobavljaca](https://www.autotek.rs/e-racuni-dobavljaca)                              |
| TecDoc                | Licensed via TecAlliance; baskets per vehicle; "integracije sa dobavljačima" for ordering                                                         | [/tec-doc](https://www.autotek.rs/tec-doc)                                                      |
| HaynesPro             | Technical data, repair times, maintenance plans                                                                                                   | [/haynes-pro](https://www.autotek.rs/haynes-pro)                                                |
| SMS and email         | SMS from the program at 1.6 RSD per message, templates, history; documents emailed to clients                                                     | [/podsetnici-i-sms-u-programu](https://www.autotek.rs/podsetnici-i-sms-u-programu)              |
| E-knjižica            | Digital service book; garage writes entries from the work order; owner sees them in a mobile app; app also offers "zakazivanje servisa"           | [/e-knjizica-...](https://www.autotek.rs/e-knjizica-elektronska-servisna-knjizica)              |
| Mobile app            | Android app: vehicle photos and basic data, auto-paired to a work order. Listing updated Aug 11, 2026, contact office@autotek.rs                  | [Google Play](https://play.google.com/store/apps/details?id=com.konkat.autotek&hl=en_US)        |
| Other                 | Tyre hotel, clocking, mechanic pay, user rights per org/warehouse/universal, reports, configurable printing, ID and registration card chip reader | menu of [/opcije-programa](https://www.autotek.rs/opcije-programa)                              |

Two hints that the program has server-side pieces beyond the desktop: the photo
feature syncs phone photos into the program "bez kablova" and stores them off
the PC ([/slikanje-vozila](https://www.autotek.rs/slikanje-vozila)), and the
e-knjižica is an online service at [eknjizica.rs](https://www.eknjizica.rs),
which search results attribute to RegOs [S]. Neither documents a public API.

---

## Evidence on API, export and integrations

| Question                                            | Finding                                                                                                                                                                                   | Status                                |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| REST/SOAP API, web services, webhooks               | Not mentioned anywhere; `/api` is a 404                                                                                                                                                   | Not documented [P]                    |
| Developer docs, SDK, GitHub                         | None found by search                                                                                                                                                                      | Not found [S]                         |
| Export to CSV/Excel/XML                             | Not mentioned. Only "štampa svih tabelarnih pregleda" (printing of every table view) is documented ([/stampa-dokumenata-u-programu](https://www.autotek.rs/stampa-dokumenata-u-programu)) | Not documented [P]                    |
| Import                                              | Only bank statements ("import izvoda"), supplier e-invoices, SEF e-invoices, ID/registration chip reads                                                                                   | Confirmed for those only [P]          |
| Accounting integration                              | Pantheon named; "svi računi i ostali dokumenti" transferred                                                                                                                               | Confirmed, mechanism unknown [P]      |
| Parts suppliers                                     | E-invoices in, TecDoc baskets, "integracije sa dobavljačima" for ordering; supplier names not given                                                                                       | Confirmed, suppliers unknown [P]      |
| SEF (state e-invoice system)                        | Full send/receive/status sync                                                                                                                                                             | Confirmed [P]                         |
| Fiscal (ESIR)                                       | Certified Dec 2021                                                                                                                                                                        | Confirmed [P]                         |
| Online booking for end clients                      | Only via the e-knjižica owner app ("zakazivanje servisa"); whether those bookings reach the AutoTEK calendar is not stated                                                                | Unknown [P]                           |
| Database engine and location                        | Not documented for AutoTEK. Sister product RegOs: local DB on the customer's PC, daily automatic backup                                                                                   | Unknown for AutoTEK [P]               |
| Multi-user / network mode                           | Per-user access rights at three levels imply several users ([/prava-pristupa-korisnika](https://www.autotek.rs/prava-pristupa-korisnika)); network topology not stated                    | Likely, not documented [P, inference] |
| Licence terms on data access or reverse engineering | No terms page on the site                                                                                                                                                                 | Unknown [P]                           |

---

## Integration options, ranked

| #   | Option                                    | What it could give us                                                                                                                                                 | Viability               | Notes                                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Ask Regos for an export or feed**       | Whatever we negotiate: work orders, clients, vehicles, stock, prices, history; maybe an inbound booking                                                               | **Best bet**            | They already ship a Pantheon bridge per customer ([/integracije](https://www.autotek.rs/integracije)), so moving data out is something they build. Cost and format unknown.                                                                                                                                                                         |
| 2   | Official public API                       | Everything, cleanly                                                                                                                                                   | **None today**          | Not documented anywhere [P]. Ask anyway; an unpublished one may exist.                                                                                                                                                                                                                                                                              |
| 3   | Ride the Pantheon-style accounting export | Invoices and "ostali dokumenti"                                                                                                                                       | Medium, if it is a file | If the bridge drops files (XML/CSV) we could read the same output. Format unknown; must ask.                                                                                                                                                                                                                                                        |
| 4   | SEF side channel                          | B2B invoices issued and received, via the state SEF API (company API key, Swagger) ([efaktura.gov.rs](https://www.efaktura.gov.rs/view_file.php?file_id=59&cache=sr)) | **Low for our use**     | Legal and stable, and independent of AutoTEK. But SEF covers B2B/B2G invoices; retail customers get fiscal receipts, not SEF invoices [G]. No work orders, vehicles or appointments. Useful only for supplier purchase invoices and fleet clients.                                                                                                  |
| 5   | Direct database reads                     | All data                                                                                                                                                              | **Risky**               | Engine, schema and location not documented. Schema changes with every automatic update ([/azuriranje-programa](https://www.autotek.rs/azuriranje-programa)), so any reader breaks silently. Licence terms unknown. Writing into it is out of the question: it would bypass stock and fiscal logic. Read-only, with written vendor consent, at most. |
| 6   | UI automation / screen scraping           | Anything a user can see                                                                                                                                               | **Last resort**         | Desktop app on the garage PC; brittle, needs that PC on, breaks on updates.                                                                                                                                                                                                                                                                         |
| 7   | Manual bridge                             | Lead goes to Telegram, staff types it into AutoTEK                                                                                                                    | **Works today**         | Zero integration. Our CRM already gives the staff the contact and the page; the booking calendar recognises client and vehicle from the plate ([/kalendar-zakazanih-radova](https://www.autotek.rs/kalendar-zakazanih-radova)).                                                                                                                     |

---

## Questions for the vendor

Contacts ([/kontakt](https://www.autotek.rs/kontakt)) [P]:

- Email: **office@autotek.rs** (Google Play listing also shows office@regos.rs)
- Sales: 060/500-21-94, 060/500-21-96 (the site header shows 060/500-21-98
  instead of -96; both appear on the site)
- Technical support: 069/55-55-011, 069/21-21-069, 064/500-21-21
- Hours: weekdays 08:00 to 17:00 (support; the footer says 09:00 to 17:00),
  Saturday 09:00 to 13:00
- Address: Miće Popovića 18, 21203 Novi Sad-Veternik

Ask:

1. Is there an API (REST, SOAP, anything) for third parties, even unpublished?
   Price and terms?
2. How does the Pantheon integration work technically: files, direct DB, web
   service? Can we receive the same feed?
3. Can work orders, clients, vehicles, stock levels and prices be exported to
   CSV, Excel or XML, on demand or on a schedule?
4. Can an external system create a booking (calendar entry) or a client/vehicle
   in AutoTEK? Do e-knjižica app bookings already land in the calendar?
5. What database does AutoTEK use, where does it live (local PC, server, your
   cloud), and does the licence allow read-only access to it by the customer?
6. Which parts suppliers are integrated for e-invoices and ordering? Does that
   include the suppliers CarLab uses?
7. Is there a stable schema or view we could read, which you keep across
   updates?

---

## Recommendation

Do not build anything against AutoTEK yet. First confirm the garage actually
runs it, then send the questions above to office@autotek.rs. Until there is an
answer, the manual bridge (option 7) is what we have, and it costs nothing. If
Regos offers an export or feed, build a one-way read into our side (stock,
prices, service history) before attempting any write into AutoTEK. Skip direct
DB access and UI automation unless the vendor declines and the value is clearly
worth a brittle integration.
