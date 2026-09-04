// Minimal GitHub REST client for writing gallery photos in prod, where the
// deployed function has no writable/persistent filesystem — Vercel's fs is
// read-only for anything meant to outlive the request (see
// admin/case-photos.astro's doc comment). Scoped to exactly the one
// operation this feature needs: add N new files + update one existing file
// in a single atomic commit, via the Git Data API (not the simpler Contents
// API, which would need one commit — and one Vercel deploy, per
// vercel.json's git.deploymentEnabled.main — per uploaded photo instead of
// one for the whole batch).
//
// Auth: callers pass the same OAuth access token Keystatic itself stores in
// its `keystatic-gh-access-token` cookie (see adminGallery.ts's
// KEYSTATIC_AUTH_COOKIE) after a manager logs into Keystatic — same token,
// same GitHub App permissions Keystatic's own commits already use.

const REPO = 'Zikrasoft/approved_rs'; // keep in sync with keystatic.config.ts's storage.repo
const BRANCH = 'main'; // keep in sync with vercel.json's git.deploymentEnabled
const API = 'https://api.github.com';

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'approved-rs-admin',
  };
}

// Carries the HTTP status so callers can distinguish "not found" from a
// real failure without regex-sniffing the error message.
export class GithubApiError extends Error {
  constructor(public status: number, path: string, body: string) {
    super(`GitHub API ${path} failed: ${status} ${body}`);
  }
}

async function ghFetch(token: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...authHeaders(token), ...init?.headers } });
  if (!res.ok) throw new GithubApiError(res.status, path, await res.text());
  return res.json();
}

// 404 means the directory doesn't exist yet (case has no gallery/ folder
// committed yet) — that's "no files", not an error.
export async function listGithubDir(token: string, dirPath: string): Promise<string[]> {
  try {
    const entries = await ghFetch(token, `/repos/${REPO}/contents/${dirPath}?ref=${BRANCH}`) as { name: string }[];
    return entries.map(e => e.name);
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 404) return [];
    throw err;
  }
}

export async function getGithubFile(token: string, filePath: string): Promise<string> {
  const data = await ghFetch(token, `/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`) as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export async function commitGalleryPhotos(token: string, opts: {
  photos: { path: string; base64: string }[];
  indexPath: string;
  indexContent: string;
  message: string;
}): Promise<void> {
  const ref = await ghFetch(token, `/repos/${REPO}/git/ref/heads/${BRANCH}`) as { object: { sha: string } };
  const baseCommitSha = ref.object.sha;
  const baseCommit = await ghFetch(token, `/repos/${REPO}/git/commits/${baseCommitSha}`) as { tree: { sha: string } };

  // Binary content (photos) needs its own blob first — Git's tree API only
  // accepts inline `content` for UTF-8 text, which index.md's new content
  // (below) qualifies for directly, skipping a blob call for it.
  const photoEntries = await Promise.all(opts.photos.map(async photo => {
    const blob = await ghFetch(token, `/repos/${REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: photo.base64, encoding: 'base64' }),
    }) as { sha: string };
    return { path: photo.path, mode: '100644', type: 'blob', sha: blob.sha };
  }));

  const tree = await ghFetch(token, `/repos/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: [...photoEntries, { path: opts.indexPath, mode: '100644', type: 'blob', content: opts.indexContent }],
    }),
  }) as { sha: string };

  const commit = await ghFetch(token, `/repos/${REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: opts.message, tree: tree.sha, parents: [baseCommitSha] }),
  }) as { sha: string };

  await ghFetch(token, `/repos/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });
}
