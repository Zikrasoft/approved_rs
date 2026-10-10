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
  LeadStatus,
  PendingPrompt,
  Referrer,
  StoredLead,
} from './schema.ts';
export { storedLeadSchema } from './schema.ts';

export {
  appendNote,
  canPostpone,
  postponePatch,
  resumePatch,
  statusPatch,
  MAX_LIST_ROWS,
  SUMMARY_TIME_ZONE,
  VISITOR_MERGE_WINDOW_MS,
} from './store.ts';
export type {
  CaptureUpdate,
  Digest,
  DraftInput,
  DraftPatch,
  LeadStore,
  MonthlySummary,
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
  SummaryMark,
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
  buildOpenList,
  buildMenu,
  buildToPay,
  buildRemindPicker,
  buildSearchResults,
  buildStats,
  createFormatter,
  EDIT_FIELD_LABELS,
  REFERRAL_NOTE,
  REPLY_COPY,
  PAYOUT_COPY,
  payoutRecordedMessage,
  OUTCOME_COPY,
  SETTLEMENT_COPY,
  settleKeyboard,
  settlementText,
  monthlySummaryText,
  MAX_SUMMARY_ROWS,
  TELEGRAM_TEXT_LIMIT,
  DRAFT_COPY,
  draftMessage,
  escapeHtml,
  formatDateRu,
  formatMoney,
} from './telegram/format.ts';
export type {
  Btn,
  EditField,
  FieldChangeAuthor,
  Keyboard,
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
