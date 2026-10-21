const PUBLISH_WORKFLOW_URL =
  'https://api.github.com/repos/Zikrasoft/approved_rs/actions/workflows/publish.yml/dispatches';

const PUBLISH_WORKFLOW_REF = 'main';

// TODO: publish.yml does not exist yet: the owner has not decided on a workflow that rebuilds and deploys carlab.rs (and runs this chain nightly), so every dispatch fails with 404 until it lands. Once it exists, wait for its run to finish instead of only for GitHub to accept the dispatch, so a failed site build stops the reindex.
export async function dispatchDeploy(token: string | undefined): Promise<void> {
  if (!token) {
    throw new Error('PUBLISH_DISPATCH_TOKEN is not set');
  }
  const response = await fetch(PUBLISH_WORKFLOW_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: PUBLISH_WORKFLOW_REF }),
  });
  if (!response.ok) {
    throw new Error(
      `GitHub refused the deploy dispatch: ${response.status} ${response.statusText}`,
    );
  }
}
