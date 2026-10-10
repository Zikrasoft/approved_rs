export { createBrandStore } from './brandStore.ts';
export type { BrandStoreOptions } from './brandStore.ts';
export { createBrandBot } from './brandBot.ts';
export type { BrandBotOptions } from './brandBot.ts';

export { LEADS_PATH } from './quarantine.ts';
export type {
  CapturePrompt,
  CaptureStep,
  LeadInput,
  LeadSubmission,
  Income,
  LeadStatus,
  PendingCommissionClaim,
  PendingPrompt,
  Payment,
  Referrer,
  StoredLead,
} from './schema.ts';

export { appendIncome, getCommission } from './money.ts';
export type { CommissionInfo } from './money.ts';

export {
  appendNote,
  canPostpone,
  postponePatch,
  resumePatch,
  statusPatch,
  wonPatch,
  MAX_LIST_ROWS,
  VISITOR_MERGE_WINDOW_MS,
} from './store.ts';
export type {
  CaptureUpdate,
  DraftInput,
  DraftPatch,
  LeadStore,
  PastLeadHints,
  PayoutInput,
} from './store.ts';
export { isSettled, ledgerBalance } from './ledger.ts';
export type {
  Draft,
  Ledger,
  LedgerAuthor,
  Payout,
  PayoutCorrection,
  PayoutEdit,
  Settlement,
} from './ledger.ts';

export type { OrderMarkers } from './orderMarkers.ts';

export {
  LOCAL_DATA_DIR,
  storedRecordsSchema,
  type LeadStorage,
} from './storage/types.ts';
export { deferOrderMarkers, deferStorage } from './storage/deferred.ts';

export { createTelegramClient } from './telegram/client.ts';
export type { TelegramClient } from './telegram/client.ts';

export {
  buildDeleteConfirm,
  canAddIncome,
  buildLeadList,
  buildMenu,
  buildToPay,
  buildRemindPicker,
  buildSearchResults,
  buildStats,
  buildStatusKeyboard,
  createFormatter,
  EDIT_COPY,
  EDIT_FIELD_LABELS,
  REFERRAL_NOTE,
  REPLY_COPY,
  PAYOUT_COPY,
  payoutRecordedMessage,
  DRAFT_COPY,
  draftMessage,
  escapeHtml,
  formatDateRu,
  formatDealsList,
  formatMoney,
  statusLabel,
  LEAD_STATUS_ACTIONS,
} from './telegram/format.ts';
export type {
  Btn,
  EditField,
  FieldChangeAuthor,
  Keyboard,
  LeadStatusKey,
  Role,
} from './telegram/format.ts';

export type {
  LeadHandOff,
  NotifyLead,
  StatusChangeOptions,
} from './notifyLead.ts';

export { contactChannelSchema, HONEYPOT_FIELD, SERVICE_FIELD } from './form.ts';

export { createLeadsRoute } from './routes/leads.ts';

export { requireEnv } from './requireEnv.ts';

export { secretMatches } from './verifySecret.ts';

export { createContactClickRoute } from './routes/contactClick.ts';
