import { leadStore, ledgerStore } from './crm';

export const {
  readOperations,
  readBalance,
  openOperationPrompt,
  findOperationPrompt,
  answerOperationPrompt,
} = ledgerStore;

export const {
  updateLeads,
  readLeads,
  getLead,
  newStoredLead,
  insertLead,
  insertOrMergeLead,
  setTelegramMessage,
  setStatus,
  touchLead,
  setPendingPrompt,
  findByPendingPrompt,
  resolvePendingPrompt,
  findByTopic,
  recordOwnerReply,
  resumeLead,
  postponeLead,
  deleteLead,
  searchLeads,
  claimDigest,
  recordDigestMessage,
  releaseDigest,
  expireGhostLeads,
  findIdleTopics,
} = leadStore;

export {
  appendNote,
  canPostpone,
  editedContact,
  hasRealContact,
  postponePatch,
  statusPatch,
  parseOperationReply,
  businessDay,
  LedgerUnreadableError,
  MAX_FIELD_LENGTH,
  MAX_LIST_ROWS,
} from '@podbor/lead-crm';

export type {
  LeadStatus,
  LedgerOperation,
  OperationType,
  PendingPrompt,
  PostedDigest,
  PromptKey,
  StoredLead,
} from '@podbor/lead-crm';
