export { createBrandStore } from './brandStore.ts';
export type { BrandStoreOptions } from './brandStore.ts';
export { createBrandBot } from './brandBot.ts';
export type { BrandBotOptions } from './brandBot.ts';

export { editedContact } from './editedContact.ts';
export {
  isHandleContact,
  isPhoneContact,
  isTelegramIdContact,
  telegramIdContact,
} from './contactShape.ts';
export type {
  CapturePrompt,
  CaptureStep,
  LeadId,
  LeadInput,
  LeadSubmission,
  LeadStatus,
  MessageKey,
  PendingPrompt,
  StoredLead,
} from './schema.ts';
export { leadIdSchema, storedLeadSchema } from './schema.ts';

export { hasRealContact } from './leadMerge.ts';
export {
  canPostpone,
  isFreshLead,
  postponePatch,
  resumePatch,
  statusPatch,
  MAX_LIST_ROWS,
  VISITOR_MERGE_WINDOW_MS,
} from './store.ts';
export type { CaptureUpdate, LeadStore, PostedDigest } from './store.ts';
export { crmDatabase } from './database.ts';
export type { LedgerOperation, OperationType } from './ledgerStore.ts';
export { parseOperationReply } from './operationReply.ts';
export { BUSINESS_TIME_ZONE, businessDay } from './businessTime.ts';

export { createTelegramClient } from './telegram/client.ts';
export type { TelegramClient } from './telegram/client.ts';

export {
  buildDeleteConfirm,
  buildRemindPicker,
  createFormatter,
  EDIT_COPY,
  EDIT_FIELD_LABELS,
  noteLine,
  reAskEditText,
  REPLY_COPY,
  LEAD_ACTION_COPY,
  managerHandoffText,
  topicLink,
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
export { extraContactNote } from './notes.ts';
export type { Btn, Keyboard, Role } from './telegram/markup.ts';

export type {
  LeadHandOff,
  NotifyLead,
  StatusChangeOptions,
} from './notifyLead.ts';

export {
  AD_SOURCE_FIELD,
  contactChannelSchema,
  HONEYPOT_FIELD,
  MAX_FIELD_LENGTH,
  META_IDS_FIELD,
  SERVICE_FIELD,
} from './form.ts';

export { createLeadsRoute } from './routes/leads.ts';
export {
  createShopOrdersRoute,
  orderLeadSubmission,
} from './routes/shopOrders.ts';

export { requireEnv } from './requireEnv.ts';
export { logError } from './logError.ts';
export { MAX_BODY_BYTES, readForm, readJson } from './bodySize.ts';

export { secretMatches } from './verifySecret.ts';

export { createContactClickRoute } from './routes/contactClick.ts';
export {
  createCspReportRoute,
  cspReportRoute,
  type CspViolation,
} from './routes/cspReport.ts';

export { createMetaLeadReporter } from './metaConversions.ts';
export type { ReportMetaLead } from './metaConversions.ts';
