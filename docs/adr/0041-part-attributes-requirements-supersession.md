---
status: accepted
---

# Part attributes as Category-defined fields with jsonb values; vehicle Requirements; supersession; quantity and position on Fitment

Decided 2026-10-20 with the owner, extending [ADR-0040](0040-one-catalog-module-vehicle-reference-tables.md). Research: `docs/research/parts-catalogue-data-models.md` and `docs/research/part-attribute-storage.md`.

**Decision:**

- **Attributes, stored as a hybrid** (Akeneo's shape):
  - Each Category defines its fields as relational rows: immutable key, type, unit, ru/sr/en label, required, facet, rank. A select field's options are rows too: immutable key, ru/sr/en label, rank.
  - The types are number with unit, single select, multi select, boolean, and text. Text is an untranslated code (e.g. `H7`); anything that needs translating is a select.
  - A Part stores its values as one `jsonb` object keyed by field key, with select values written as option keys.
  - Renaming an option changes only its label. Deleting or retyping a field, or deleting an option, is refused while anything uses it.
- **Requirements.** An Engine, a Chassis or a Vehicle can state what a universal Part must satisfy: a field, the allowed option keys or a numeric range, and a quantity (e.g. B47: engine oil, approval `bmw-ll-04`, 5.2 l). A Part matches when it satisfies every Requirement for its Category:
  - a number is in the range;
  - a single select is in the allowed set;
  - a multi select shares at least one allowed key.
- **One attributes module, three calls:**
  - validate a Part's values against its Category's definition;
  - match values against Requirements;
  - guard definition changes.

  The storefront build, VIN resolution and the admin all match through it, so the rule exists once. Typesense fields are generated from the definitions at each Publish.

- **Supersession.**
  - When an old and a new number are interchangeable both ways, the old one stays an identifier of the same Part, marked superseded.
  - A one-way replacement is two Parts joined by "replaced by", with cycles refused.
  - A replaced Part keeps an indexable page that names its replacement, because customers search old numbers from labels.
- **Fitment** gains:
  - a quantity;
  - a position (axle: front/rear; side: left/right);
  - an optional free-text note in Russian, translated at Publish.

  "Confirm your variant" applies within one Category and one position, and a Fitment with a note always asks.

- **Maintenance kit.** A Category flag and rank mark what a "maintenance kit" contains. The kit is assembled from Fitments and Requirements per Vehicle and never stored.
- **Provenance.** Every catalogue row records who created and last changed it, and when. There is no full change history; database backups cover rollback.

## Considered Options

- **EAV value rows with foreign keys** (Saleor/Magento). Rejected: heavier queries and admin for a few thousand rows, and Magento itself keeps no foreign key on option values.
- **Plain jsonb with no definition rows.** Rejected: nothing to validate against or translate.
- **Attribute schemas in code (zod per Category).** Rejected: Categories are admin-managed, and a new field must not need a deploy.
- **Typesense as the only store of attributes.** Rejected: it is a derived index rebuilt at Publish, not a source of truth.
- **Supersession only as extra identifiers.** Rejected: it misstates one-way replacements.

## Consequences

- Option-key integrity inside `jsonb` is enforced by the attributes module, not by Postgres. Every write path must go through it.
- Whether Typesense can facet a pattern field such as `attr_.*` is unverified; the generated explicit schema avoids depending on it.
