# Shop migrations

Unqualified paths are relative to `apps/auto-service-shop/`.

`apps/auto-service-shop` migrates its Postgres while the previous image is still
serving, and a rollback brings that image back over the new schema (deploy
order in [deploy.md](deploy.md)). So every shop migration is **additive**:
add a column nullable or with a default, add a table or an index. A rename or a
drop ships in two deploys, first the code that stops reading the old shape,
then the migration that removes it.

The one sanctioned exception is the pre-launch squash of spec #404: until the
shop opens (`SHOP_OPEN=true`), each module's history is folded into a single
generated initial migration plus its single hand-written one, and schema changes
are folded into them. The production database was dropped and recreated for
the catalog and supplier refold, which is what makes this possible while the
shop is closed; every fold recreates it again. From the day the shop opens,
every schema change is a new additive migration beside the initial ones; never
edit a migration a database holding real orders has run.

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
runs once after every module migration. `check` runs
`.github/scripts/shop-migration-drift.sh`, which fails when `medusa db:generate`
on a fresh database writes anything.

## The manifest

**The migration files are frozen by a manifest.** `apps/auto-service-shop/migrations.sha256`
lists the sha256 of every file under `src/modules/*/migrations/*.ts` and
`src/migration-scripts/*.ts`, and `.github/scripts/shop-migrations-frozen.sh`
in `check` fails when a listed file changes or disappears, or when a migration
file is missing from the list. A new migration is appended to it in the same
commit: `cd apps/auto-service-shop && sha256sum <file> >>migrations.sha256`.
The manifest is frozen from the day the shop opens: after that, a failing check
means a migration a database has run was edited, and the fix is to restore the
file and add a new migration, never to rewrite the hash. Until then, a
pre-launch fold into an initial migration rewrites its line
(`sha256sum src/modules/*/migrations/*.ts src/migration-scripts/*.ts >migrations.sha256`),
and every long-lived database (production, the demo, a staging copy) is
recreated from scratch after the fold, because MikroORM skips a migration by name and never
replays an edited one.
