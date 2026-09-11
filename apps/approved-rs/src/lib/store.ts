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
  claimFullCommission,
  confirmCommissionPayment,
  rejectCommissionPayment,
  searchLeads,
  getDuePostponed,
  getOwedSummary,
} = leadStore;

export {
  appendNote,
  getCommission,
  roundMoney,
  MAX_LIST_ROWS,
} from '@podbor/lead-crm';

export type {
  CommissionInfo,
  LeadStatus,
  OwedRow,
  Payment,
  PendingCommissionClaim,
  PendingPrompt,
  StoredLead,
} from '@podbor/lead-crm';
