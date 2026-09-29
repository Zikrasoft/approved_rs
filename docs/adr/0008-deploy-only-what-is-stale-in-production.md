# Deploy only the apps that are stale in production, measured against `deployed/<app>` tags

On `main`, the `scope` step in `verify` computes which apps differ from what is live, and both deploy jobs read that list. The comparison base is a per-app `refs/tags/deployed/<app>` tag that each deploy job moves after it succeeds — not the previous commit. "What changed in this push" and "what is in production" are different questions: an app whose deploy failed and has not changed since would never reappear in a diff against the previous commit.

Every unknown answers "deploy": no tag yet, tag not an ancestor of `HEAD` (force-push), a changed root build file (`pnpm-lock.yaml`, `turbo.json`, `package.json`, `.npmrc`, …), a turbo crash or unparseable output. The only "skip" is turbo positively listing the changed packages without this app. A wrong "deploy" costs one extra deploy; a wrong "skip" leaves production silently stale under a green CI.

## Considered Options

- **A separate `translate.yml` plus a `gate` job over `workflow_run`**: used before and double-deployed `main`. `gate` read the push payload's `commits` array, which GitHub sends as `null` on merge commits, while the other workflow's `paths:` filter read the real diff; two answers to one question diverged. Now there is one answer, computed from git history in an existing checkout.

## Consequences

- The filter is `turbo --filter="...[<tag>]"` — the leading dots pull in dependents, so a `packages/*` change deploys all apps (see [ADR-0003](0003-one-bot-one-lead-store-brand-field.md)). Narrowing it to app directories would let two lead-schema versions write one blob.
- turbo attributes root files to the `//` package, so they are checked by a separate `git diff` against a hand-kept list; a new file that affects the build must be added to it.
- Deleting a `deployed/*` tag is the safe way to force one redeploy. Moving one forward by hand is dangerous: CI then believes production holds a commit it does not.
- A change outside git (env var, dashboard setting, Blob rotation) needs the manual "Deploy every app, whatever the tags say" run.
- Tag protection rules must not cover `deployed/*`, and Workflow permissions must be "Read and write", or the tag step fails after the site is already live and the next run redeploys it.
