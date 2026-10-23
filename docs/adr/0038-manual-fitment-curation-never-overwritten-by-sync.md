---
status: superseded by ADR-0039
---

# Manual fitment curation is never overwritten by an automatic sync

Decided 2026-10-17, as part of [wayfinder map #320](https://github.com/Zikrasoft/approved_rs/issues/320) (the VIN-based parts shop for carlab.rs).

Staff curate `Fitment` rows (see [ADR-0037](https://github.com/Zikrasoft/approved_rs/blob/main/docs/adr/0037-vehicle-fitment-ktype-vehicleidentifier-conditional-join.md)) by hand alongside whatever licensed automatic fitment-data source eventually gets chosen. The owner's standing decision (#321) treats both paths as equally weighted, not one a fallback for the other. No automatic source is actually licensed yet (a quote request to QUANTUM-AutoMARKET for TecDoc, and a Parts-Catalogs.com trial, are both still open), so this decision has to hold regardless of which vendor's sync job eventually runs.

**Decision:** every `Fitment` row carries `source` (`manual` or `auto:<vendor>`) and `status` (`active` or `rejected`). A sync job never touches or recreates a row it didn't itself create: it skips any `manual` row outright, and skips re-adding a `rejected` row that it previously supplied itself, forever (not until the next data refresh). Staff "attach this Part to this Vehicle" starts by searching existing `Part`s by any `PartIdentifier` number (OEM/manufacturer/EAN), creating inline only when nothing matches; the `Vehicle` side is picked from the already-licensed catalogue only; a missing configuration is a data/licensing gap to close upstream, not something staff patch around with an ad-hoc row (that would reopen exactly what ADR-0028/0037 ruled out).

## Considered options

- **Flag conflicts for staff review instead of manual-always-wins.** Rejected: catches the case where staff made the mistake, but makes every sync cycle a chore when the data source is simply noisy or re-asserts something staff already corrected, and the common case would dominate the rare one.
- **Delete a rejected automatic row outright.** Rejected: the next sync just recreates it, turning "I fixed this" into a recurring task instead of a one-time decision.
- **Let staff create an ad-hoc Vehicle when the licensed catalogue has a gap.** Rejected: this is the same free-text-dictionary shape ADR-0028 and ADR-0037 already ruled out, just reintroduced one row at a time; a coverage gap belongs in the research/licensing conversation, not in the data model.

## Consequences

A `Part` or `Vehicle` without the licensed data to back it simply can't get a `Fitment` row yet: staff curation extends coverage within what's licensed, it doesn't substitute for licensing it. If an automatic source is later found to have been systematically wrong about something staff didn't catch individually, there's no mechanism here to bulk-reconcile; that would need its own decision if it comes up.
