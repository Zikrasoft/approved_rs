# One repository, three independent brand sites

approved.rs (vehicle sourcing), carlab.rs (car service + parts shop) and details.rs (detailing) live in one pnpm + Turborepo workspace as `apps/*`, each a separate Vercel project on its own domain. The portfolio is meant to read as three unrelated businesses, so the rule is about branding only: no shared brand root in names or domains, and nothing that carries Approved's trust/verification semantics. The sites being traceable to each other (one repo, one phone number, one address, a similar typeface) is accepted, not a defect.

## Considered Options

- **Subsections of approved.rs** (`approved.rs/detailing`): rejected — the whole point was to stop the service brands borrowing, and diluting, the sourcing brand's trust claim.
- **Separate repositories**: rejected — the lead pipeline, i18n pipeline and bot are shared machinery and would have to be versioned and released three times.
