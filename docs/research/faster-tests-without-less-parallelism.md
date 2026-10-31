# Faster tests without less parallelism

Research date: **2026-10-16**. Question from the owner: the test suite is slow
and times out when everything runs at once. Cutting parallelism (fewer workers,
`fileParallelism: false`, `singleFork`, `turbo --concurrency=1`, a bigger
`testTimeout`) is not an acceptable fix. Where does the time actually go, and
what makes the tests themselves cheaper so full parallelism stays?

## Source status

- **[M]** measured in this session on the machine below. Every lever tried was
  reverted; nothing in this file is committed code.
- **[P]** primary source read in this session: vitest, jest, Turborepo, GitHub
  and openai-node documentation, or vitest 3.2.6 source in `node_modules`.
- **[UNKNOWN]** could not be established.

---

## Verdict first

1. **The wall clock is set by `apps/medusa`, not by vitest.** Its `test` script
   runs jest with `--runInBand --coverage --coverageProvider=v8`. Alone that takes
   **63.5 s**; the same command without `--runInBand` takes **7.4 s** with an
   identical coverage table (99.36 % statements, 96.09 % branches) and exit 0.
   Under the full turbo run it took **73 s and 142 s**, which is the whole
   critical path of `pnpm test`. [M] The repo already serialises one suite, and
   that one serialisation costs more than everything else combined.
2. **The one recurring failure is a test that does expensive work inside the
   test body.** `apps/approved-rs/src/utils/contactLinks.test.ts` calls
   `vi.resetModules()` and re-imports `./contactLinks` in every test, which
   re-parses and re-validates `services.yaml` through `servicesView`. Alone the
   first test takes 423 ms; under the full run it timed out at 5000 ms in all
   three runs. [M]
3. **Everything else is CPU contention**, not slow tests. approved-rs sums
   12 to 14 s of collect time when run alone and 70 to 89 s inside the full turbo
   run, for the same 33 files. [M] The levers below cut CPU per test file, which
   is what shrinks contention while parallelism stays where it is.

---

## Measured baseline

### Machine and tool versions [M]

- Apple Silicon, 10 cores (`hw.perflevel0` 8 performance + `hw.perflevel1` 2
  efficiency), 32 GB RAM, macOS (Darwin 25.3.0), Node 24.21.0.
- vitest 3.2.6, `@vitest/coverage-v8` 3.2.6, jest 29.7.0 with `@swc/jest`.

### How processes multiply

- Turborepo runs up to **10** tasks at once by default:
  "**Default:** `10`" for `--concurrency`.
  https://turborepo.dev/docs/reference/run [P]
- vitest 3.2.6 in run mode uses `Math.max(numCpus - 1, 1)` forks per process
  (`node_modules/vitest/dist/chunks/coverage.DfSpMS-b.js`, line 2610,
  `vitest.config.watch ? Math.max(Math.floor(numCpus / 2), 1) : Math.max(numCpus - 1, 1)`),
  so **9** forks here. [P]
- `pnpm test` runs 9 vitest workspaces plus medusa's jest concurrently: up to
  9 x 9 = 81 test forks plus their parents on 10 cores. Seven of the nine
  vitest workspaces overlap for most of the run. [M]
- CI: the repository is public, so `ubuntu-latest` has **4 CPUs, 16 GB**
  ("Linux" runner with "4" CPUs and "16 GB" of memory).
  https://docs.github.com/en/actions/reference/runners/github-hosted-runners [P]
  vitest then starts 3 forks per workspace, turbo still runs up to 10 tasks.

### Full run, `pnpm turbo run test --force` [M]

| Run | Flags                | Wall    | Medusa jest `Time:` | Result                                       |
| --- | -------------------- | ------- | ------------------- | -------------------------------------------- |
| 1   | `--force`            | 20.7 s  | interrupted         | approved-rs failed, turbo stopped the rest   |
| 2   | `--force --continue` | 78.3 s  | 73.4 s              | approved-rs `contactLinks.test.ts` timed out |
| 3   | `--force --continue` | 147.5 s | 141.8 s             | same timeout                                 |

Run 1 also measured 106 s user + 25 s sys CPU in 20.7 s wall (6.3 cores busy on
average) before it stopped.

vitest per-workspace `Duration` line in run 2 (phase times are sums across
workers, so they exceed wall time):

| Workspace    | Files | Duration | transform | collect | tests  | environment |
| ------------ | ----- | -------- | --------- | ------- | ------ | ----------- |
| approved-rs  | 33    | 12.9 s   | 16.4 s    | 69.8 s  | 9.1 s  | 0           |
| auto-service | 41    | 12.6 s   | 15.5 s    | 61.1 s  | 4.3 s  | 9.9 s       |
| detailing    | 11    | 11.4 s   | 11.9 s    | 39.6 s  | 0.9 s  | 0           |
| lead-crm     | 37    | 11.8 s   | 6.8 s     | 29.3 s  | 13.9 s | 10.1 s      |
| site-kit     | 34    | 12.2 s   | 7.5 s     | 16.3 s  | 5.0 s  | 35.2 s      |
| lead-capture | 4     | 10.1 s   | 2.3 s     | 15.0 s  | 2.0 s  | 0           |
| i18n         | 20    | 7.4 s    | 5.4 s     | 16.8 s  | 6.1 s  | 0           |
| shop-catalog | 9     | 3.1 s    | 1.6 s     | 3.9 s   | 0.6 s  | 0           |
| brands       | 3     | 1.8 s    | 0.5 s     | 1.0 s   | 0.02 s | 0           |

The same workspaces run alone finish in 2.5 to 5 s each (approved-rs: 3.0 to
5.2 s over three runs, 17.1 s user CPU).

### Per file, each file run alone without coverage [M]

All 180 vitest files were run one at a time. Slowest:

| File                                                       | Total  | collect | tests  | environment | What costs                                   |
| ---------------------------------------------------------- | ------ | ------- | ------ | ----------- | -------------------------------------------- |
| `packages/i18n/src/translate/sections.test.ts`             | 3.2 s  | 0.16 s  | 2.76 s | 0           | openai SDK retry backoff (lever 4)           |
| `apps/approved-rs/src/pages/api/_telegram-capture.test.ts` | 2.3 s  | 1.98 s  | 0.06 s | 0           | module graph at collect [UNKNOWN which part] |
| `apps/approved-rs/src/pages/api/_telegram-webhook.test.ts` | 1.9 s  | 1.32 s  | 0.15 s | 0           | same; imports the `date-fns` barrel          |
| `apps/approved-rs/src/lib/captureBot.test.ts`              | 1.7 s  | 1.44 s  | 0      | 0           | module graph                                 |
| `packages/lead-crm/src/ledgerStore.test.ts`                | 1.5 s  | 0.09 s  | 1.26 s | 0           | [UNKNOWN]                                    |
| `packages/i18n/src/translate/openaiChat.test.ts`           | 1.1 s  | 0.09 s  | 0.80 s | 0           | openai SDK retry backoff                     |
| `packages/lead-crm/src/leadForm.test.ts`                   | 1.0 s  | 0.03 s  | 0.46 s | 0.32 s      | jsdom                                        |
| `apps/approved-rs/src/utils/contactLinks.test.ts`          | 0.94 s | 0.08 s  | 0.67 s | 0           | `vi.resetModules` + YAML reload per test     |
| `apps/auto-service/src/scripts/devMode.test.ts`            | 0.72 s | 0.02 s  | 0.01 s | 0.47 s      | jsdom                                        |

jsdom costs 0.3 to 0.5 s of `environment` per file; 30 files use it
(`// @vitest-environment jsdom`). site-kit's summed environment time is 35 to
48 s under the full run.

### Import cost of dependencies, native Node, cold [M]

| Import                                                     | ms          |
| ---------------------------------------------------------- | ----------- |
| `date-fns` (root barrel)                                   | 595 to 1067 |
| `date-fns/format` + `addDays` + `differenceInCalendarDays` | 54 to 57    |
| `@vercel/blob`                                             | 218         |
| `libphonenumber-js`                                        | 75          |
| `grammy`                                                   | 70          |
| `zod`                                                      | 57          |
| `yaml`                                                     | 23          |

---

## Ranked levers

### 1. Drop `--runInBand` from `apps/medusa`'s `test` script

- **Gain [M]:** 63.5 s to 7.4 s alone (8.6x), same coverage numbers, exit 0.
  Without coverage: 15.8 s in band, 5.9 s with workers. In the full run medusa
  was the last task to finish both times, so this removes roughly 55 to 135 s
  from `pnpm test` wall time on this machine.
- **Effort:** delete one flag in `apps/medusa/package.json`.
- **Risk:** low for `TEST_TYPE=unit`. `integration-tests/setup.js` already gives
  each `JEST_WORKER_ID` its own Redis database, so parallel workers were planned
  for. The commit that added the flag (`f775467e`, "Scaffold the Medusa app with
  jest and a validated env") gives no reason. Keep `--runInBand` (or not) for the
  `integration:http` run separately; that run was not measured here.
- **Evidence [P]:** `--runInBand`: "Run all tests serially in the current
  process, rather than creating a worker pool of child processes that run tests.
  This can be useful for debugging." Default `--maxWorkers`: "the number of the
  cores available on your machine minus one". https://jestjs.io/docs/cli
- Why in-band v8 coverage costs about 1.8 s per suite (every suite took 1.9 to
  2.5 s in band with coverage) is [UNKNOWN]; only the effect was measured.
- This lever adds parallelism, it does not remove any.

### 2. Stop rebuilding the module graph inside `contactLinks.test.ts`

- **Gain [M]:** removes the only test that failed in every full run. Alone the
  first test costs 423 ms, 667 ms for the file's test phase; under load it
  passed 5000 ms.
- **Cause [M]:** each test calls `vi.resetModules()` then imports
  `./contactLinks`, which imports `@/i18n/content/services`, so every test
  re-parses and zod-validates the YAML inside the test's timeout instead of once
  at collect.
- **Fix options:** import `contactLinks` once at the top and pass the manager
  handle another way (the `humanTelegram` branch already lives in
  `createContactControls` in `@podbor/site-kit/contact-control`, which has its
  own 100 % suite), or `vi.doMock('./constants')` so only the constants module
  changes. Effort: one file. Risk: low.
- The same pattern (`vi.resetModules`) appears in 9 test files across apps and
  packages; those were not individually slow alone, but any that reloads a YAML
  section inside a test body carries the same risk.

### 3. `isolate: false` for the six `packages/*`

- **Gain [M], user CPU, no coverage:**

  | Workspace    | isolate (default) | `--no-isolate` |
  | ------------ | ----------------- | -------------- |
  | lead-crm     | 13.8 s            | 9.8 s (-29 %)  |
  | site-kit     | 16.1 s            | 10.2 s (-37 %) |
  | approved-rs  | 18.1 s            | 12.2 s (-33 %) |
  | auto-service | 19.1 s            | 14.3 s (-25 %) |

- **Safety [M]:** all six packages passed `--no-isolate --sequence.shuffle` with
  seeds 1, 2 and 3. The apps did not: approved-rs failed
  `src/utils/casesQueries.test.ts` under `--no-isolate` without shuffling, so
  cross-file state leaks there. Keep the apps isolated until those leaks are
  found.
- **Effort:** one line per package `vitest.config.ts`.
- **Evidence [P]:** "By default Vitest runs every test file in an isolated
  environment based on the pool"; disabling it via `--no-isolate` or
  `test.isolate: false` helps "projects that don't rely on side effects and
  properly cleanup their state". https://v3.vitest.dev/guide/improving-performance
  Config: disabling isolation "may improve performance ... particularly those
  using the `node` environment". https://v3.vitest.dev/config/
- **Risk:** medium. A future test that leaks state passes or fails depending on
  file order. Running `--sequence.shuffle` in CI would surface that, but see the
  shuffle finding under Open questions.

### 4. Make the OpenAI error mocks non-retryable

- **Gain [M]:** `packages/i18n/src/translate/sections.test.ts` tests phase
  2.76 s to 0.26 s with `openAiErrorResponse`'s default status changed from 500
  to 400 in `src/translate/mockOpenAiFetch.ts`; all 219 tests in
  `src/translate` still passed.
- **Cause [P]:** "Connection errors ..., 408 Request Timeout, 409 Conflict,
  429 Rate Limit, and >=500 Internal errors will all be retried by default",
  with "short exponential backoff".
  https://github.com/openai/openai-node/blob/master/README.md
  `callOpenAiJson` sets `maxRetries: OPENAI_MAX_RETRIES` (1), so each mocked
  500 waits one real backoff.
- **Effort:** one default value. The one test that must exercise the retry
  (`openaiChat.test.ts`, "retries exactly once", 435 ms) can keep a 500; whether
  `vi.useFakeTimers()` can skip the SDK's sleep there is [UNKNOWN], not tried.
- **Risk:** low.

### 5. Use jsdom only where a test touches the DOM

- **Gain [M]:** `apps/auto-service/src/scripts/phone.test.ts` has no DOM
  reference; switched to `node` it went from 1.56 s (982 ms environment) to
  0.29 s, same 3 passing tests. Each jsdom file pays 0.3 to 0.5 s of
  environment alone, more under load.
- **Effort:** audit 30 files. `scrollLock.test.ts`, `submitQueue.test.ts` and
  `fieldValidity.test.ts` have 1 to 2 DOM references each and are the next
  candidates; not tried.
- **Evidence [P]:** jsdom and happy-dom "come with performance costs due to
  their design for DOM simulation". https://v3.vitest.dev/config/
- `happy-dom` instead of `jsdom` was not measured (not installed) [UNKNOWN].

### 6. Import `date-fns` by subpath

- **Gain [M]:** root barrel 595 to 1067 ms vs about 55 ms for the three
  functions by subpath. Changing the two imports
  (`packages/lead-crm/src/telegram/markup.ts`,
  `apps/approved-rs/src/pages/api/telegram-webhook.ts`) to `date-fns/format`,
  `date-fns/parseISO`, `date-fns/parse`, `date-fns/isValid` cut user CPU for
  approved-rs 17.1 s to 14.6 s (-15 %) and lead-crm 13.1 s to 11.9 s (-9 %),
  three runs each, all tests passing. Wall time alone was within noise.
- **Effort:** two import lines. **Risk:** low.
- Whether this also shortens the deployed functions' cold start is [UNKNOWN],
  not measured.

### 7. Persist the turbo cache in CI

- `pnpm test` runs in both the `check` and `verify` jobs of
  `.github/workflows/ci.yml`, and no step restores `.turbo` or sets
  `TURBO_TOKEN`, so every run is a cold miss. When the translate job commits
  nothing, `verify` re-runs the exact inputs `check` already tested.
- **Evidence [P]:** Turborepo documents `actions/cache@v4` with `path: .turbo`,
  `key: ${{ runner.os }}-turbo-${{ github.sha }}` and a `restore-keys` prefix,
  or the Vercel Remote Cache via OIDC.
  https://turborepo.dev/docs/guides/ci-vendors/github-actions
- **Gain:** [UNKNOWN], CI was not measured. **Effort:** one step in
  `.github/actions/setup-pnpm`. **Risk:** low; turbo hashes inputs, and `test`
  has no `outputs`, so only logs are replayed.

### 8. Fewer coverage reporters in packages

- Coverage costs 13 to 15 % CPU on lead-crm and site-kit [M] (site-kit user
  14.5 s to 16.6 s). The 100 % threshold is policy, so coverage stays.
- The default reporter set is `['text', 'html', 'clover', 'json']`
  https://v3.vitest.dev/config/ [P]. Nothing in the repo reads html, clover or
  json; setting `reporter: ['text']` skips writing them. Gain not isolated
  [UNKNOWN]. Effort: one line per package.

### 9. One vitest process for all workspaces (`projects`)

- Running the 9 vitest workspaces as `projects` of one root config would give
  them one shared pool of `numCpus - 1` forks instead of nine pools of
  `numCpus - 1` each. That removes oversubscription without lowering the core
  count in use. https://v3.vitest.dev/config/ documents `projects` [P].
- **Cost:** per-package turbo caching and per-package coverage thresholds would
  have to move into one config. Gain [UNKNOWN], not tried; largest effort on
  this list.

---

## What not to do, and why

- **No `maxWorkers`, `fileParallelism: false`, `singleFork`,
  `poolOptions.forks.singleFork`, or `turbo --concurrency=1`.** The owner ruled
  these out, and the measurements agree: the contention is caused by work each
  file repeats (collect, jsdom, retries), and serialising only makes the same
  work queue longer. Medusa is the proof in this repo: its one serialised suite
  is 8.6x slower than its parallel run and sets the wall time.
- **No bigger `testTimeout`.** The one timeout is a test doing a full YAML
  reload in its body; a longer timeout hides it and lets the next one in.
- **No `pool: 'vmThreads'` to dodge isolation cost.** "If you are using
  `vmThreads` pool, you cannot disable isolation."
  https://v3.vitest.dev/guide/improving-performance [P]
- **Switching to `pool: 'threads'`** was measured and is not worth it on its
  own: user CPU within noise for lead-crm, approved-rs and auto-service
  (12.8 vs 13.8, 18.3 vs 18.1, 18.7 vs 19.1 s), site-kit 14.3 vs 16.1 s. [M]
  The docs say forks are "better for compatibility issues" and threads only
  "slightly" faster. [P]

---

## Open questions

- **Intra-file order dependency, separate from isolation [M]:** under
  `--sequence.shuffle` with isolation on, the `_telegram-capture.test.ts` file
  in each of the three apps fails "opens a service card from the services
  content, in Serbian", and approved-rs's `_telegram-webhook.test.ts` fails "a
  ledger file that does not parse > still opens the menu ...". These pass in the
  default order, so they are not today's flake, but they share state between
  tests and would break any shuffled or `isolate: false` run.
- What exactly costs ~1.2 to 2 s of collect in the `_telegram-*` and
  `captureBot` files is [UNKNOWN]. grammY itself imports in 70 ms natively;
  vitest 3.2.6 has no per-import timing report, and this was not traced
  further.
- Why `ledgerStore.test.ts` spends 1.26 s in tests alone is [UNKNOWN]; its
  slowest single tests were about 40 ms in verbose output.
- None of the levers were measured on a 4-CPU GitHub runner.
- The medusa `integration:http` suite was not run.
