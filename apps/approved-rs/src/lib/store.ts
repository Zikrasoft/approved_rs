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
  resolvePendingPrompt,
  archiveLead,
  unarchiveLead,
  resumeLead,
  postponeLead,
  deleteLead,
  claimCommission,
  confirmCommissionPayment,
  rejectCommissionPayment,
  searchLeads,
  getDuePostponed,
  getOwedSummary,
} = leadStore;

export {
  appendIncome,
  appendNote,
  getCommission,
  MAX_LIST_ROWS,
} from '@podbor/lead-crm';

export type {
  CommissionInfo,
  Income,
  LeadStatus,
  OwedRow,
  Payment,
  PendingCommissionClaim,
  PendingPrompt,
  StoredLead,
} from '@podbor/lead-crm';
