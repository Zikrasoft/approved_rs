# GitHub Actions builds and deploys; Vercel only hosts

`git.deploymentEnabled: false` turns off Vercel's git integration, and the `deploy` / `deploy-brand-site` jobs in `.github/workflows/ci.yml` run `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` from inside each `apps/<app>`. The Vercel project only stores env vars and the domain and is the deploy target.

## Considered Options

- **Vercel builds from git** (with `ignoreCommand` / `scripts/vercel-ignore-build.sh`): used before, dropped. Checks ran twice (Actions and again in Vercel's container), and a pnpm version mismatch between the two made real content deploys get silently skipped as "Canceled by Ignored Build Step". Now there is one check and the deployed commit is the one that passed it.

## Consequences

The `git.deploymentEnabled: false` block exists in the root `vercel.json` **and** in all three apps' `vercel.json`: which file Vercel reads depends on each project's Root Directory setting, and duplicating it is the only arrangement correct for any setting.
