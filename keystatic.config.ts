import { config } from '@keystatic/core';
import {
  casesCollection,
  autoserviceCasesCollection,
  detailingCasesCollection,
} from './src/i18n/keystatic/caseCollections';

export default config({
  // Local dev reads/writes the working tree directly — no GitHub OAuth,
  // and edits show up immediately without a commit+push round trip. On
  // Vercel the filesystem is ephemeral, so production has to go through
  // GitHub's API to actually persist anything.
  storage: import.meta.env.PROD
    ? { kind: 'github', repo: 'Zikrasoft/approved_rs' }
    : { kind: 'local' },

  collections: {
    cases: casesCollection,
    autoserviceCases: autoserviceCasesCollection,
    detailingCases: detailingCasesCollection,
  },
});
