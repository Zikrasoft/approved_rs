import { leadStore } from './crm';

export const {
  updateLeads,
  readLeads,
  getLead,
  newStoredLead,
  insertLead,
  insertOrMergeLead,
  setTelegramMessage,
  setStatus,
  setPendingPrompt,
  findByPendingPrompt,
  findByCard,
  addNote,
  resolvePendingPrompt,
  archiveLead,
  unarchiveLead,
  resumeLead,
  postponeLead,
  deleteLead,
  searchLeads,
  getDuePostponed,
  readLedger,
  getBalance,
  listPayouts,
  addPayout,
  correctPayout,
  addSettlement,
  settleBalance,
  expireGhostLeads,
} = leadStore;

export {
  appendIncome,
  appendNote,
  canPostpone,
  getCommission,
  isSettled,
  postponePatch,
  wonPatch,
  MAX_LIST_ROWS,
} from '@podbor/lead-crm';

export type {
  CommissionInfo,
  Income,
  LeadStatus,
  Payout,
  Settlement,
  Payment,
  PendingPrompt,
  StoredLead,
} from '@podbor/lead-crm';
