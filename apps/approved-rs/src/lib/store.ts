import { leadStore, ledgerStore } from './crm';

export const {
  readOperations,
  readBalance,
  recordOperation,
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
  findByCard,
  addNote,
  resolvePendingPrompt,
  resumeLead,
  postponeLead,
  deleteLead,
  searchLeads,
  claimDigest,
  releaseDigest,
  readLedger,
  getBalance,
  listPayouts,
  addPayout,
  correctPayout,
  setPayoutPrompt,
  findPayoutByPrompt,
  addSettlement,
  addSettlePrompt,
  findSettlePrompt,
  settleBalance,
  expireGhostLeads,
  claimMonthlySummary,
  releaseMonthlySummary,
} = leadStore;

export {
  appendNote,
  canPostpone,
  isSettled,
  postponePatch,
  parseOperationReply,
  MAX_LIST_ROWS,
} from '@podbor/lead-crm';

export type {
  LeadStatus,
  LedgerOperation,
  OperationType,
  Payout,
  Settlement,
  PendingPrompt,
  StoredLead,
} from '@podbor/lead-crm';
