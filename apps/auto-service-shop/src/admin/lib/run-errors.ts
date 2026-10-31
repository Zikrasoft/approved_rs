import { ABANDONED, INTERRUPTED_BY_RESTART } from '../../lib/run-errors';

const KNOWN_ERRORS: Record<string, string> = {
  'OPENAI_API_KEY is not set': 'publish.knownErrors.openAiKey',
  'PUBLISH_DISPATCH_TOKEN is not set': 'publish.knownErrors.dispatchToken',
  'The deploy run did not succeed': 'publish.knownErrors.deployFailed',
  'The deploy run timed out': 'publish.knownErrors.deployTimedOut',
  [ABANDONED]: 'publish.knownErrors.abandoned',
  [INTERRUPTED_BY_RESTART]: 'publish.knownErrors.interrupted',
};

export const knownError = (error: string | null) => {
  const known = Object.keys(KNOWN_ERRORS).find((prefix) =>
    error?.startsWith(prefix),
  );
  return known ? KNOWN_ERRORS[known] : null;
};
