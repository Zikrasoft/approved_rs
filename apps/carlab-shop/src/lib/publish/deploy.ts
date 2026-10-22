import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';

const PUBLISH_WORKFLOW_URL =
  'https://api.github.com/repos/Zikrasoft/approved_rs/actions/workflows/publish.yml/dispatches';

const PUBLISH_WORKFLOW_REF = 'main';

export const DEPLOY_TIMEOUT_MS = 90 * 60 * 1000;

const DEPLOY_POLL_MS = 30 * 1000;

const dispatchedRunSchema = z.object({
  run_url: z.url(),
  html_url: z.url(),
});

const workflowRunSchema = z.object({
  status: z.string(),
  conclusion: z.string().nullable(),
});

type Pacing = { pollMs: number; timeoutMs: number };

const githubHeaders = (token: string) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

async function dispatchRun(token: string) {
  const response = await fetch(PUBLISH_WORKFLOW_URL, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({
      ref: PUBLISH_WORKFLOW_REF,
      return_run_details: true,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `GitHub refused the deploy dispatch: ${response.status} ${response.statusText}`,
    );
  }
  return dispatchedRunSchema.parse(await response.json());
}

async function runConclusion(token: string, runUrl: string) {
  const response = await fetch(runUrl, { headers: githubHeaders(token) }).catch(
    () => null,
  );
  if (!response || response.status >= 500) {
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `GitHub refused the deploy run status: ${response.status} ${response.statusText}`,
    );
  }
  const run = workflowRunSchema.parse(await response.json());
  return run.status === 'completed' ? (run.conclusion ?? 'unknown') : null;
}

export async function deploySite(
  token: string | undefined,
  { pollMs, timeoutMs }: Pacing = {
    pollMs: DEPLOY_POLL_MS,
    timeoutMs: DEPLOY_TIMEOUT_MS,
  },
): Promise<void> {
  if (!token) {
    throw new Error('PUBLISH_DISPATCH_TOKEN is not set');
  }
  const run = await dispatchRun(token);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const conclusion = await runConclusion(token, run.run_url);
    if (conclusion === 'success') {
      return;
    }
    if (conclusion) {
      throw new Error(
        `The deploy run did not succeed: ${conclusion} ${run.html_url}`,
      );
    }
    await sleep(pollMs);
  }
  throw new Error(`The deploy run timed out: ${run.html_url}`);
}
