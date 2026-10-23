# GA4 exclusions

Who to drop from any sample before drawing conclusions about traffic or
conversion. Applies to all three properties — their measurement ids are listed in
[deploy.md](deploy.md), and to the Yandex Metrika counters running beside them
since 2026-10-23 ([ADR-0044](../adr/0044-yandex-metrika-beside-ga4.md)), where a
client id is the `_ym_uid` cookie. Before 2026-10-14 this applied to Metrika alone; see
[ADR-0033](../adr/0033-google-analytics-instead-of-yandex-metrica.md) for the
cutover.

The vocabulary of events and key events is in [analytics.md](analytics.md).

## The owners' and the partner's client ids

The list itself lives in `.local/analytics-exclusions.txt`, which is in
`.gitignore`. These are the browser identifiers of specific people and this
repository is public: a client id equals the value of GA4's `_ga` cookie, which
any script on its own domain can read, so a published list turns an ordinary XSS
into one aimed at the owner. The file's format is one id per line.

The scale that justified the filter under Metrika: on approved.rs between
2026-08-31 and 2026-09-22 those browsers accounted for 105 of 273 visits and 6 of
14 form submissions. Without the filter, conversion is roughly doubled — assume
the same order of magnitude holds under GA4 until re-measured.

## Russia

The `Russia` region is excluded wholesale: there are no clients there — it is our
own people plus incidental traffic. Over the same period, another 9 visits.

## How to apply it

GA4's Data API (`runReport`) has no client-id dimension in standard reports
either, but `BigQuery export` or the Data API's `googleAnalyticsAdmin` audience
tooling can filter by it; absent that, build a sample by hand the same shape as
before:

1. Pull `sessions` with dimensions `country`, event parameters including the
   stored client id (via a custom dimension registered on the property, or from
   raw BigQuery export if that is ever turned on), and the key events of
   interest.
2. Filter locally against `.local/analytics-exclusions.txt` and by country, then
   aggregate.

The client id is not exposed as a standard GA4 report dimension without either a
registered custom dimension or BigQuery export — neither is configured yet; until
one is, excluding owner/partner traffic from a report has to go through GA4's
native filters below rather than the per-id list.

## What is already set inside GA4 itself

Each property's Admin → Data Settings → Data Filters supports an "Internal
traffic" filter keyed on IP address (static home/office IPs only — unlike
Metrika's cookie-based `exclude uniq_id me`, it does not follow a person's phone
on mobile data) and a "Developer traffic" filter keyed on a `debug_mode` event
parameter. Neither is configured yet; a clientID-equivalent filter does not exist
in GA4's interface the way it didn't in Metrika's either.

Each property's Data Stream also restricts collection to its own domain by
construction (one stream per property, one domain per stream) — there is no
separate "only this domain" filter to set, unlike Metrika's `include url
only_mirrors`.
