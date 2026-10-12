export { createBrandStore } from './brandStore.ts';
export type { BrandStoreOptions } from './brandStore.ts';
export { createBrandBot } from './brandBot.ts';
export type { BrandBotOptions } from './brandBot.ts';

export { LEADS_PATH } from './quarantine.ts';
export {
  isHandleContact,
  isPhoneContact,
  isTelegramIdContact,
  telegramIdContact,
} from './contactShape.ts';
export type {
  CapturePrompt,
  CaptureStep,
  LeadInput,
  LeadSubmission,
  LeadStatus,
  PendingPrompt,
  StoredLead,
} from './schema.ts';
export type { PromptKey } from './promptKey.ts';
export { storedLeadSchema } from './schema.ts';

export {
  appendNote,
  canPostpone,
  isFreshLead,
  postponePatch,
  resumePatch,
  statusPatch,
  MAX_LIST_ROWS,
  VISITOR_MERGE_WINDOW_MS,
} from './store.ts';
export type { CaptureUpdate, LeadStore } from './store.ts';
export { LEDGER_PATH, LedgerUnreadableError } from './ledgerStore.ts';
export type { LedgerOperation, OperationType } from './ledgerStore.ts';
export { parseOperationReply } from './operationReply.ts';
export { BUSINESS_TIME_ZONE, businessDay } from './businessTime.ts';

export type { OrderMarkers } from './orderMarkers.ts';

export {
  LOCAL_DATA_DIR,
  storedRecordsSchema,
  type LeadStorage,
} from './storage/types.ts';

export { createTelegramClient } from './telegram/client.ts';
export type { TelegramClient } from './telegram/client.ts';

export {
  buildDeleteConfirm,
  buildRemindPicker,
  createFormatter,
  EDIT_FIELD_LABELS,
  REPLY_COPY,
  LEAD_ACTION_COPY,
} from './telegram/cards.ts';
export type { EditField } from './telegram/cards.ts';
export {
  buildOpenList,
  buildMenu,
  buildSearchResults,
} from './telegram/menu.ts';
export {
  buildBalance,
  LEDGER_COPY,
  operationRecordedText,
  operationRefusedText,
  reAskOperationText,
} from './telegram/ledger.ts';
export { buildStats } from './telegram/stats.ts';
export { escapeHtml, formatDateRu, formatMoney } from './telegram/markup.ts';
export type { Btn, Keyboard, Role } from './telegram/markup.ts';

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
