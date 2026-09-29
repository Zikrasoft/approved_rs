# One Keystatic GitHub App per site, all writing to the same repository

In production Keystatic stores content through the GitHub API (`storage: { kind: 'github' }`) because Vercel's filesystem is ephemeral; locally it writes the working tree. A GitHub App's OAuth callback is tied to one domain, so each of the three sites has its own App, all installed on `Zikrasoft/approved_rs`, each with its own `KEYSTATIC_*` values.

## Consequences

- GitHub's contents API resolves from the repo root, so every collection path is prefixed `` `${APP_ROOT}src/content/...` `` with `APP_ROOT = 'apps/<app>/'` in production and `''` in dev. Forgetting it made Keystatic write to the wrong place after the monorepo move.
- `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` must not be marked Sensitive in Vercel (sensitive vars are unavailable at build, and the admin bundle needs the slug).
- A site without these vars builds and serves every page; only `/keystatic` login is dead. carlab.rs and details.rs ran like that for twelve days. Check: `curl -o /dev/null -w '%{http_code}' https://<domain>/api/keystatic/github/login` → 307, not 500.
