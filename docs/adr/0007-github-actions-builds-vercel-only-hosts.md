# GitHub Actions builds and deploys; Vercel only hosts

`git.deploymentEnabled: false` turns off Vercel's git integration, and the `deploy` / `deploy-brand-site` jobs in `.github/workflows/ci.yml` run `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` from inside each `apps/<app>`. The Vercel project only stores env vars and the domain and is the deploy target.

## Considered Options

- **Vercel builds from git** (with `ignoreCommand` / `scripts/vercel-ignore-build.sh`): used before, dropped. Checks ran twice (Actions and again in Vercel's container), and a pnpm version mismatch between the two made real content deploys get silently skipped as "Canceled by Ignored Build Step". Now there is one check and the deployed commit is the one that passed it.

## Consequences

- The `git.deploymentEnabled: false` block exists in the root `vercel.json` **and** in all three apps' `vercel.json`: which file Vercel reads depends on each project's Root Directory setting, and duplicating it is the only arrangement correct for any setting. Without it every branch push starts a failing preview build.
- The project's Root Directory must stay empty (`./`); the job already runs inside `apps/<app>`, and a Root Directory on top makes `vercel deploy` look for `apps/<app>/apps/<app>` while the build still passes green.
- Env vars live in the Vercel dashboard, not GitHub secrets, and only take effect on the next deploy (`PUBLIC_*` are inlined into HTML). A missing var does not fail the build: `PUBLIC_*` becomes `undefined` in markup, and `requireEnv` in `crmBot.ts` fails the first real `/api/leads` request, not the build.
- `deploy-brand-site`'s `guard` step skips and stays green when `VERCEL_PROJECT_ID_*` is empty — a misconfiguration looks like a successful deploy unless the log is read.
- `pnpm-workspace.yaml` keeps build allow-lists in both pnpm 11 (`allowBuilds`) and pnpm 10 (`onlyBuiltDependencies`) form, for the case where Vercel itself builds (dashboard Redeploy), since Vercel supports pnpm ≤10.
