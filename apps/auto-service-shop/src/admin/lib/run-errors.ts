import {
  ABANDONED,
  INTERRUPTED_BY_RESTART,
} from '../../modules/_shared/run-errors';

const KNOWN_ERRORS: Record<string, string> = {
  'OPENAI_API_KEY is not set': 'publish.knownErrors.openAiKey',
  'The Publish would leave': 'publish.knownErrors.shrinkRefused',
  [ABANDONED]: 'publish.knownErrors.abandoned',
  [INTERRUPTED_BY_RESTART]: 'publish.knownErrors.interrupted',
};

export const knownError = (error: string | null) => {
  const known = Object.keys(KNOWN_ERRORS).find((prefix) =>
    error?.startsWith(prefix),
  );
  return known ? KNOWN_ERRORS[known] : null;
};
