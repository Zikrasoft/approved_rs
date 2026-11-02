# Coding standards

The rules every change in this repository follows: good architecture,
SOLID, DRY and TDD. AGENTS.md holds the repository-specific rules, such as
markup contracts, package boundaries, i18n, migrations and deploys. This file
holds the general ones. Where the two overlap, AGENTS.md wins on specifics.

## Architecture

- **Deep modules.** A module gives a lot of behaviour behind a small interface.
  If deleting a module would only remove a pass-through, it should not exist.
  If the same logic would reappear in several callers, it earned its place.
- **Invariants live with the data.** The module that owns a table, a file or a
  blob enforces that data's rules: uniqueness, guards, locks and transactions.
  Callers such as routes, seeds, importers or the storefront never re-check or
  bypass them.
- **Seams where something varies.** Put an interface where two adapters really
  exist, or where a test needs a substitute. One adapter is a hypothetical seam
  and stays plain code.
- **Narrow interfaces.** A caller knows what it needs and nothing about table
  shapes, internal states or another module's storage. Cross-module data goes
  through the owning module's interface. When shared SQL is unavoidable, it
  lives in one owned place.
- **Derived data is rebuildable.** Search indexes, snapshots and caches are
  projections, rebuilt from the source of truth. Nothing lives only in a
  projection.

## SOLID

- **Single responsibility.** A module changes for one reason. Split a file that
  is edited for unrelated reasons.
- **Open for extension.** A new category field, supplier, locale or brand is
  data or configuration, not an edit across callers.
- **Substitutable adapters.** Every adapter at a seam honours the whole
  interface, including its error modes and ordering guarantees.
- **Interface segregation.** Callers depend on the narrow export they use. The
  narrow subpath exports of `packages/*` work this way.
- **Dependency inversion.** Accept dependencies, such as storage, clocks and
  network clients, instead of constructing them inside. Return results instead
  of producing hidden side effects.

## DRY

- **One source of truth per rule or definition.** Category fields, the listed
  rule, best offer, event names and contact channels are each defined once and
  imported.
- **The second copy is the signal.** When the same logic would exist twice,
  extract it now: within an app into a module, across apps into
  `packages/*` together with its tests.
- **Components, not copies.** Repeated markup with its styling and behaviour is
  a component, never pasted between pages.
- **DRY is about knowledge, not keystrokes.** Two things that look alike but
  change for different reasons stay separate.

## TDD and tests

- **Use the built-in `tdd` skill.** Every feature and every bug fix starts by
  loading the `tdd` skill (Skill tool, `tdd`) and following its loop. A coding
  agent that builds or fixes code does this before writing code, and its brief
  says so.
- **Red, green, refactor.** Write the failing test first, see it fail for the
  right reason, then write the fix.
- **Cover every change completely.** Test each new or changed branch, edge case
  and failure path. `packages/*` hold 100% coverage, enforced in CI. In apps,
  report the coverage of the touched files and explain any gap.
- **Test behaviour through the interface.** Render the component, call the
  route, run the module. Do not assert on source text or fake a module's
  internals.
- **Every route touched gets an integration test.** In the shop, an integration
  spec against real Postgres and Typesense.
- **Races are tested as races.** A lock, a transaction or a concurrent writer
  gets a concurrency test.

## Simplicity

- **The shortest working change that respects the rules above.** No
  speculative abstraction, configuration for a value that never changes, or
  scaffolding for later.
- **No code comments.** A name or structure that needs explaining gets
  renamed or restructured. A known limit or a planned follow-up is a `TODO:`
  marker that names its ceiling.
- **Validate at trust boundaries with zod.** No hand-rolled guards or bare
  casts on inbound data.
