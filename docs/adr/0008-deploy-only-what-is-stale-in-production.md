# Deploy only the apps that are stale in production, measured against `deployed/<app>` tags

On `main`, the `scope` step in `verify` computes which apps differ from what is live, and both deploy jobs read that list. The comparison base is a per-app `refs/tags/deployed/<app>` tag that each deploy job moves after it succeeds — not the previous commit. "What changed in this push" and "what is in production" are different questions: an app whose deploy failed and has not changed since would never reappear in a diff against the previous commit.

Every unknown answers "deploy": no tag yet, tag not an ancestor of `HEAD` (force-push), a changed root build file (`pnpm-lock.yaml`, `turbo.json`, `package.json`, `.npmrc`, …), a turbo crash or unparseable output. The only "skip" is turbo positively listing the changed packages without this app. A wrong "deploy" costs one extra deploy; a wrong "skip" leaves production silently stale under a green CI.

## Considered Options

- **A separate `translate.yml` plus a `gate` job over `workflow_run`**: used before and double-deployed `main`. `gate` read the push payload's `commits` array, which GitHub sends as `null` on merge commits, while the other workflow's `paths:` filter read the real diff; two answers to one question diverged. Now there is one answer, computed from git history in an existing checkout.
