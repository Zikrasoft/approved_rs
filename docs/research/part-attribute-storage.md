# Storing per-Category part attributes

Research date: **2026-10-20**. Question: how should the `catalog` module store
the attribute fields each Category defines, their option lists, the values each
Part holds, and the Engine/Vehicle requirements matched against them? The
decisions this builds on (Category-owned fields with an immutable key and a type
of number-with-unit, single select, multi select, boolean or text; translatable
labels and options; no delete or type change while values exist; requirement
matching for universal goods; SSG plus Typesense) are taken as given. Background
on TecDoc and PIES is in
[`parts-catalogue-data-models.md`](parts-catalogue-data-models.md), the module
shape in [ADR-0040](../adr/0040-one-catalog-module-vehicle-reference-tables.md),
terms in [`GLOSSARY.md`](../../GLOSSARY.md).

## Answer

Use the hybrid every modern system converges on: **definitions and options are
relational rows, values are one `jsonb` object on Part keyed by field key, and
select values are stable option keys, never ids or labels.** Akeneo stores
exactly this (option rows with a `code`, product values as JSON holding option
codes), Sylius and Shopware keep their custom data as JSON, and Magento's typed
EAV, the classic alternative, holds option ids with no foreign key to the
option table and multi-select as a comma-joined string, so it does not buy the
integrity it appears to. At our size (hundreds to low thousands of Parts) speed
decides nothing; what decides is that every rule (type, unit, allowed options,
required fields, "option in use") already has to live in application code,
because Postgres cannot enforce any of them across tables, and a JSON value
makes that one place small: one zod schema built from the Category's
definitions, one row write, a document that maps straight onto SSG pages and
Typesense fields. The price is that "option in use" is a query, not a foreign
key; with immutable keys a rename touches no Part, and a delete is refused by
the same module that validates writes. Requirements reference fields by
foreign key and options by key. No GIN index is needed.

## Source status

- **[P]** primary: official docs, or source and schema files read directly in
  this session (GitHub raw files on the default branch, or `node_modules` for
  Medusa 2.21.2).
- **[S]** secondary: a search summary or our own reading of a primary source.
- **[NOT ESTABLISHED]** could not be verified.

Source names are quoted; names in the sketch at the end are **proposals**.

## 1. How established systems store attributes

### Magento 2 (typed EAV)

- **[P]** `app/code/Magento/Catalog/etc/db_schema.xml` and
  `app/code/Magento/Eav/etc/db_schema.xml` (branch `2.4-develop`): values live
  in one table per backend type, `catalog_product_entity_int`, `_decimal`,
  `_varchar`, `_text`, `_datetime`, each holding `attribute_id`, `store_id`,
  `entity_id` and `value`. Definitions are `eav_attribute` (`attribute_code`,
  `backend_type`, `frontend_input`, `source_model`, `is_required`,
  `is_unique` …), grouped by `eav_attribute_set` and `eav_attribute_group`.
  Options are `eav_attribute_option` plus per-store labels in
  `eav_attribute_option_value (option_id, store_id, value)`; attribute labels
  per store in `eav_attribute_label`.
- **[P]** Foreign keys on `catalog_product_entity_int` point at `eav_attribute`,
  `catalog_product_entity` and `store`, all `onDelete="CASCADE"`. **There is no
  foreign key from `value` to `eav_attribute_option`**: a select value is a bare
  int.
- **[P]** Multi-select goes through `Magento\Eav\Model\Entity\Attribute\Backend\ArrayBackend::beforeSave`,
  which does `implode(',', $data)`: option ids saved as one comma-separated
  string.
- **[P]** Flat tables were the performance escape hatch, now discouraged:
  "Use of a flat catalog is no longer recommended as a best practice. Continued
  use of this feature is known to cause performance degradation and other
  indexing issues."
  ([Adobe, Flat catalogs](https://experienceleague.adobe.com/en/docs/commerce-admin/catalog/catalog/catalog-flat)).
  The same page names the cause: EAV "can result in lengthy, complex SQL
  queries".

### Akeneo PIM (relational definitions, JSON values)

- **[P]** `Product.orm.yml` (pim-community-dev `master`): table
  `pim_catalog_product`, field `rawValues` mapped to column `raw_values`,
  `type: json`; the `family` relation is `family_id … onDelete: 'SET NULL'`.
- **[P]** `AttributeOption.orm.yml`: table `pim_catalog_attribute_option`,
  `code` (length 100), `sort_order`, unique `(code, attribute_id)`, FK to the
  attribute `onDelete: CASCADE`. `AttributeOptionValue.orm.yml`:
  `pim_catalog_attribute_option_value (locale_code, value, option_id)`, unique
  `(locale_code, option_id)`. Labels are one row per locale.
- **[P]** Inside `raw_values` a value is addressed by attribute, then channel,
  then locale, with literal `<all_channels>` / `<all_locales>` for
  non-scoped values (`SqlGetProductLabels.php`). The API format says a simple
  select's `data` is the option code (`"data": "blue"`), a multi select's an
  array of codes, a metric `{ "amount", "unit" }`
  ([Akeneo API, products](https://api.akeneo.com/concepts/products.html)).
- **[P]** Option deletion is handled in application code, not by the database:
  "If a product had this value, it will be removed from the product's
  attribute", deletion is blocked when the option is a variant axis or used by
  a published product, and changing an attribute's type requires deleting the
  attribute ([Akeneo help, Manage your attributes](https://help.akeneo.com/v7-build-your-catalog/v7-manage-your-attributes)).
  Product search runs on Elasticsearch, not SQL over the JSON (bundle path
  `Enrichment/Bundle/Elasticsearch`) **[S]**.

### Saleor (fully relational)

- **[P]** `saleor/attribute/models/base.py` (`main`): `Attribute` (`slug`
  unique, `input_type`, `unit`, `value_required`, M2M `product_types`),
  `AttributeTranslation`, `AttributeValue` (FK `attribute`, `slug` unique per
  attribute, and typed columns `plain_text`, `boolean`, `date_time`, `numeric`,
  `reference_*`), `AttributeValueTranslation`.
- **[P]** `saleor/attribute/models/product.py`: `AssignedProductAttributeValue`
  has FK `value` → `AttributeValue` and FK `product`, both `on_delete=CASCADE`,
  `unique_together = (("value", "product"),)`. `AttributeProduct` binds an
  attribute to a `product_type`. The `AssignedProductAttribute` model named in
  older Saleor docs is not in this file on `main`; when it was removed is
  **[NOT ESTABLISHED]**.
- **[S]** Even a number is an `AttributeValue` row; deleting one cascades.

### Shopware 6 (options relational, custom fields JSON)

- **[P]** `PropertyGroupDefinition` (`property_group`: translated `name`,
  `display_type`, `filterable`), `PropertyGroupOptionDefinition`
  (`property_group_option`, FK `property_group_id`, translated `name`),
  `ProductPropertyDefinition` (`product_property`: primary key
  `product_id` + `property_group_option_id`). Properties are option sets only;
  there is no numeric property type.
- **[P]** Custom fields: `CustomFieldDefinition` (`custom_field`: `name` and
  `type` both flagged `Immutable`, `config` as `JsonField`), values in the
  entity's `customFields`, declared as a `TranslatedField` (so stored per
  translation) on property groups and options.

### Sylius (one value table, a column per type)

- **[P]** `AttributeValue.orm.xml` (`2.1`): `sylius_attribute_value` mapped
  superclass (`sylius_product_attribute_value` for products) with `locale_code`
  and `text_value`, `boolean_value`, `integer_value`, `float_value`,
  `datetime_value`, `date_value`, `json_value`. `Attribute.orm.xml`: `code`
  unique, `type`, `storage_type`, `configuration` (json), `translatable`.
- **[P]** A select attribute's `getStorageType()` returns `STORAGE_JSON`; its
  choices live in the attribute's `configuration['choices']`, keyed by
  `Uuid::uuid1()` and holding a label per locale
  (`SelectAttributeChoicesCollectionType.php`). So option values are JSON keys
  with no foreign key, exactly the hybrid's weakness, inside an EAV design.

### Vendure and Medusa

- **[P]** Vendure custom fields: "a column will be added for each custom
  field", and "changes to custom fields require a database migration"; a
  `struct` type (v3.1+) stores sub-fields as JSON
  ([Vendure docs](https://docs.vendure.io/guides/developer-guide/custom-fields/)).
  Facets are `Facet` → `FacetValue` (`code`, translations,
  `onDelete: 'CASCADE'`), joined to products by a `@ManyToMany … @JoinTable()`
  (`product.entity.ts`, `facet-value.entity.ts`). Typed-per-attribute columns,
  therefore, are developer-managed, not admin-managed.
- **[P]** Medusa 2.21.2 `@medusajs/product`: `product_option` (`title`
  `.translatable()`) and `product_option_value` (`value` `.translatable()`)
  exist to build variants, plus `metadata: model.json()` on product. Neither is
  a typed attribute system, and our Part is a custom-module entity anyway.
  `model.text().translatable()` (since 2.13) translates text properties;
  ADR-0040 already chose a JSON translations column instead.
- **[P]** Medusa DML (`@medusajs/utils` 2.21.2): `model.json()` maps to column
  type `jsonb` (`define-property.js`). `EntityIndex` accepts `type` ("The type
  of the index. (e.g: GIN)"), and `createPsqlIndexStatementHelper` emits
  `CREATE INDEX … USING ${type} ("col")`, adding `WHERE deleted_at IS NULL`
  unless `where: null`. Column names are quoted and `on` is typed to model
  properties, so an operator class such as `jsonb_path_ops` or an expression
  index cannot be declared: that needs a hand-written migration. A plain
  `USING GIN` (default `jsonb_ops`) can be declared in DML.

### TecDoc and PIES

- From the earlier note **[P]**: TecDoc keeps one criteria dictionary
  (`050 Criteria Table`, `Type` A/N/D/K/V, a key table for `K`), stores article
  values as rows `210 Article Criteria (CritNo, CritVal)`, and says per generic
  article which criteria are mandatory (`328`). That is EAV with a typed
  dictionary, built for a file exchange format, not for editing. PAdb defines
  attributes per part type with valid values. PIES element names for attribute
  values were not checked **[NOT ESTABLISHED]**.

## 2. What Postgres can and cannot enforce

- **[P]** "PostgreSQL does not support `CHECK` constraints that reference table
  data other than the new or updated row being checked"; a trigger is the
  suggested substitute for a one-time check
  ([Postgres, Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)).
  So "this value is valid for its field's current definition" cannot be a
  CHECK in any of the designs, EAV included.
- **[P]** A foreign key "must reference columns that either are a primary key or
  form a unique constraint, or are columns from a non-partial unique index".
  A key inside a `jsonb` document can never be the referencing side. And since
  Medusa makes indexes partial by default, a foreign key onto an option's
  `(field_id, key)` would also need `where: null`.
- **[P]** GIN on `jsonb`: default `jsonb_ops` supports `?`, `?|`, `?&`, `@>`,
  `@?`, `@@`; `jsonb_path_ops` "does not support the key-exists operators" but
  is smaller and more selective. Docs advise that a JSON document "represent an
  atomic datum" because any update locks the whole row
  ([Postgres, JSON types](https://www.postgresql.org/docs/current/datatype-json.html)).
  A Part's attribute set is such a datum: staff save it as one form.
- Our queries **[S]**: single select `attributes->>'viscosity' = ANY($1)`;
  multi select any-of `attributes->'approvals' ?| $1` (array key-exists, which
  `jsonb_path_ops` cannot serve); number range
  `(attributes->>'length_mm')::numeric BETWEEN $1 AND $2`; "option in use"
  `attributes @> '{"approvals":["bmw-ll-04"]}'`. On a few thousand rows a
  sequential scan answers each in milliseconds, so no index is warranted.

## 3. Options against our needs

| Need                     | jsonb on Part only                       | EAV value rows (+ option FK)                                | Typed tables per attribute     | Hybrid (defs + options relational, values jsonb) | Typesense-only facets        |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------- | ------------------------------ | ------------------------------------------------ | ---------------------------- |
| Option rename            | Labels in jsonb defs, ok if keyed        | Free (label row)                                            | Free                           | Free: label changes, key immutable               | Reindex                      |
| Option delete while used | App query                                | DB `RESTRICT` if added (Magento has no FK, Saleor cascades) | DB FK                          | App query in the validator                       | Not detectable               |
| Validation in one place  | Yes, but defs have no home               | No: type per field still needs code or triggers             | DDL plus code                  | Yes: one schema from rows                        | None                         |
| Translations             | Ad hoc                                   | Label rows or JSON column                                   | Per table                      | JSON column on field and option (ADR-0040)       | Per-locale docs              |
| Requirement matching     | One TS predicate                         | Joins per field type                                        | Joins per table                | One TS predicate, SQL possible                   | Runtime only, no write check |
| SSG + Typesense export   | Document already shaped                  | Pivot rows to document                                      | Union of tables                | Document already shaped                          | Is the index                 |
| Medusa admin form        | One object                               | Row diffing per save                                        | Impossible without a migration | One object, rendered from defs                   | n/a                          |
| Admin-defined fields     | Yes                                      | Yes                                                         | **No** (migration per field)   | Yes                                              | Yes                          |
| Migration effort         | 1 column                                 | 3 to 4 tables                                               | Per field                      | 1 column + 2 tables                              | 0, but no source of truth    |
| Used by                  | Medusa `metadata`, Shopware custom field | Magento, TecDoc `210`, Saleor, Sylius values                | Vendure custom fields          | Akeneo, Sylius select, Shopware custom fields    | none as storage              |

Rejected: **typed tables** need a migration per field (Vendure).
**Typesense-only** has no source of truth or write check. **jsonb without
definition rows** leaves options and labels nowhere to live. **EAV** buys only a
database `RESTRICT` on option delete, and only with an option FK that Magento
and Sylius do not have; it costs a row diff per save, a pivot for SSG and
Typesense, and the per-type rule stays in code anyway.

## 4. Recommendation: the hybrid

### Tables (names are proposals)

```text
category_field                      -- one field a Category defines
  id            text pk
  category_id   fk -> category  (ON DELETE RESTRICT while fields exist)
  key           text            -- immutable, ^[a-z][a-z0-9_]*$, unique (category_id, key)
  type          text            -- number | single_select | multi_select | boolean | text; immutable while used
  unit          text null       -- number only: 'mm' | 'W' | 'l' | 'V' …; immutable while used
  label         jsonb           -- { ru, sr, en }, ADR-0040 translations column
  required      boolean
  facet         boolean         -- shown as a storefront filter
  rank          int

category_field_option               -- one allowed value of a select field
  id            text pk
  field_id      fk -> category_field (ON DELETE CASCADE, only reachable when unused)
  key           text            -- immutable, unique (field_id, key); 'bmw-ll-04', 'mb-229-51', '5w-30'
  label         jsonb           -- { ru, sr, en }
  rank          int

part.attributes jsonb not null default '{}'
  -- { "viscosity": "5w-30", "approvals": ["bmw-ll-04"], "length_mm": 600 }
  -- CHECK (jsonb_typeof(attributes) = 'object'): the only in-row rule worth a constraint

attribute_requirement               -- what an Engine or Vehicle needs from a Category
  id            text pk
  engine_id     fk null -> engine   (ON DELETE CASCADE)
  vehicle_id    fk null -> vehicle  (ON DELETE CASCADE)
  field_id      fk -> category_field (ON DELETE RESTRICT)   -- category follows from the field
  option_keys   text[] null         -- single/multi select, boolean as 'true'/'false'
  min_value     numeric null        -- number; equality is min = max
  max_value     numeric null
  quantity      numeric null        -- 5.2 (litres), 2 (wiper blades)
  CHECK (num_nonnulls(engine_id, vehicle_id) = 1)
```

- **Option references are keys, not ids.** Keys are what Akeneo stores
  (`code`), they read in a dump, survive an export and re-import, and are the
  Typesense facet value. Renaming an option edits `label` only; no Part or
  requirement changes. An id would add nothing but a lookup.
- **Translations** are the `label` JSON on field and option, filled by the
  existing translate pipeline from `ru`. Text values on Part (a thread size, a
  socket code) are treated as untranslated codes; whether any text field needs
  per-locale values is an open question **[NOT ESTABLISHED]**.
- **Requirements** use a real FK to the field, so a field with requirements
  cannot be deleted, and option keys that the validator checks like Part
  values. Chassis-level requirements are left out until a case needs them; an
  Engine row covers oil, a Vehicle row covers wipers and bulbs.
- **No index on `attributes`.** If one is ever needed, a DML
  `{ on: ['attributes'], type: 'GIN' }` gives `jsonb_ops`, which serves both
  `@>` and `?|`.

### The validation module (deep: three calls)

```ts
type Values = Record<string, number | string | string[] | boolean>;

interface PartAttributes {
  /** Loads the Category's fields and options, returns canonical values or throws per-key errors. */
  parse(categoryId: string, input: unknown): Promise<Values>;
  /** True when values satisfy every requirement of that Category. */
  matches(values: Values, requirements: Requirement[]): boolean;
  /** Refuses a field or option delete, or a type or unit change, while anything uses it. */
  guard(change: DefinitionChange): Promise<void>;
}
```

- `parse` builds a zod `strict()` object from the definitions on each call
  (unknown keys, wrong type, unit-less numbers, option keys not in the list,
  missing required fields all fail), sorts and dedupes multi-select arrays, and
  is the only path to `part.attributes` and to `attribute_requirement`.
- `matches` is the single matching rule (number in `[min, max]`, single select
  in `option_keys`, multi select intersects `option_keys`, a missing value
  never matches). The SSG build, the VIN endpoint and the admin "which Parts
  fit" preview all call it over data already in memory, so no SQL copy of the
  rule exists to drift.
- `guard` runs the "in use" queries (containment over Parts, `option_keys`
  over requirements) inside the same transaction as the definition write. This
  is the integrity a foreign key would have given, kept in one place.

### SSG and Typesense

- The Publish build reads Categories with fields and options once, then Parts;
  page copy resolves `label[locale]` from the definitions.
- At reindex, each facet field becomes an explicit Typesense field built from
  the definitions: select and multi select as `string[]` of keys with
  `facet: true`, numbers as `float`, booleans as `bool`, named
  `attr_<category>_<key>` **(proposal)**. The storefront maps facet keys to
  labels from the definitions shipped in the build. Typesense says a `.*`
  wildcard field cannot be faceted; whether a narrower regex field such as
  `attr_.*` can be **[NOT ESTABLISHED]**, so the explicit schema is the safe
  route and is regenerated at every Publish anyway.

Migration effort: one `jsonb` column, three tables, this module with its tests,
and a Part form rendered from the Category's fields. A new field is an admin
action, never a migration.
