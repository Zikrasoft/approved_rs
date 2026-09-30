# Yandex Metrika exclusions

Who to drop from any sample before drawing conclusions about traffic or
conversion. Applies to all three counters — their ids are listed in
[deploy.md](deploy.md).

The vocabulary of events and goals is in [analytics.md](analytics.md).

## The owners' and the partner's clientIDs

The list itself lives in `.local/analytics-exclusions.txt`, which is in
`.gitignore`. These are the browser identifiers of specific people and this
repository is public: a clientID equals the value of the `_ym_uid` cookie, which
any script on its own domain can read, so a published list turns an ordinary XSS
into one aimed at the owner. The file's format is one id per line.

The scale that justifies the filter: on approved.rs between 2026-08-31 and
2026-09-22 those browsers accounted for 105 of 273 visits and 6 of 14 form
submissions. Without the filter, conversion is roughly doubled.

## Russia

The `Russia` region is excluded wholesale: there are no clients there — it is our
own people plus incidental traffic. Over the same period, another 9 visits.

## How to apply it

The Reporting API has no `clientID`, neither as a dimension nor as a filter —
only `ym:s:clientID` in the Logs API. So a sample with exclusions is built like
this:

1. `logs_request` with `source: "visits"` and the fields `ym:s:clientID`,
   `ym:s:regionCountry`, `ym:s:goalsID`, `ym:s:date`, `ym:s:startURL`,
   `ym:s:pageViews`, `ym:s:visitDuration`, `ym:s:bounce`
2. download, filter locally against `.local/analytics-exclusions.txt` and by
   country, then aggregate
3. `logs_clean`, to free the counter's quota

In the logs the country arrives as a string (`Russia`, `Serbia`), not as a
numeric region id.

## What is already set inside Metrika itself

All three counters have the `exclude uniq_id me` filter active — "don't count my
visits". It works off a browser cookie and only covers the browsers the counter's
reports were opened from, so the partner's phones and browsers are not caught by
it. A clientID filter does not exist in Metrika's interface.
