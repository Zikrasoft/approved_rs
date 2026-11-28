# Shop migrations

Unqualified paths are relative to `apps/auto-service-shop/`.

`apps/auto-service-shop` migrates its Postgres while the previous image is still
serving, and a rollback brings that image back over the new schema (deploy
order in [deploy.md](deploy.md)). So every shop migration is **additive**:
add a column nullable or with a default, add a table or an index. A rename or a
drop ships in two deploys, first the code that stops reading the old shape,
then the migration that removes it.

Production holds the crawled catalogue, so no database is recreated any more:
every schema change is a new generated migration beside the initial ones, and a
migration a database has run is never edited, open shop or not.

## Generated and hand-written migrations

Generate a module's migration with `medusa db:generate <module>` and leave the
generated file as it comes. SQL the model DSL cannot express (`NULLS NOT
DISTINCT`, an expression index) lives in a hand-written migration of its own,
with the index left out of the model so the generator never rewrites it, and
`src/modules/catalog/__tests__/hand-written-indexes.spec.ts` asserts it
against `pg_indexes` through `src/lib/schema-check.ts`. The same module
compares the database with every `.snapshot-*.json` and with the two crawl
tables, which belong to no module (see [deploy.md](deploy.md), Data lifecycle);
a column type only a hand-written migration sets is listed there in
`HAND_WRITTEN_TYPES`, a hand-written index in `HAND_WRITTEN_INDEXES`. A new
hand-written index, type or constraint goes into that module, not only into the
spec. `deploy.sh` runs the same assertions against the live database right after
`db:migrate` (`medusa exec ./src/scripts/check-schema.js`) and stops the deploy
before the seed, with the previous image still serving, when the schema is not
what the migrations build. An index on one of Medusa's own tables
(the `order` time indexes) cannot sit in our modules' migrations, which may run
before Medusa's; it is a script in `src/migration-scripts/`, which `db:migrate`
runs once after every module migration. The `shop-drift` job runs
`.github/scripts/shop-migration-drift.sh`, which fails when `medusa db:generate`
on a fresh database writes anything.

## The manifest

**The migration files are frozen by a manifest.** `apps/auto-service-shop/migrations.sha256`
lists the sha256 of every file under `src/modules/*/migrations/*.ts` and
`src/migration-scripts/*.ts`, and `.github/scripts/migrations-frozen.sh`
in the `static` job fails when a listed file changes or disappears, or when a migration
file is missing from the list. A new migration is appended to it in the same
commit: `cd apps/auto-service-shop && sha256sum <file> >>migrations.sha256`.
A failing check means a migration a database has run was edited: restore the
file and add a new migration, never rewrite the hash. On a push to `main` the
check also compares the manifest with the previous `main` (`FROZEN_BASE`), so a
listed line rewritten together with its file fails too.
