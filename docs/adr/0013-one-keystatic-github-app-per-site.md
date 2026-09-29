# One Keystatic GitHub App per site, all writing to the same repository

In production Keystatic stores content through the GitHub API (`storage: { kind: 'github' }`) because Vercel's filesystem is ephemeral; locally it writes the working tree. A GitHub App's OAuth callback is tied to one domain, so each of the three sites has its own App, all installed on `Zikrasoft/approved_rs`, each with its own `KEYSTATIC_*` values.
