export { CAPTURE_STEPS, createLeadSchema } from './schema.ts';
export { createQuarantine, LEADS_PATH, QUARANTINE_PATH } from './quarantine.ts';
export type {
  CapturePrompt,
  LeadInput,
  LeadSubmission,
  LeadSchemaOptions,
  Income,
  LeadStatus,
  PendingCommissionClaim,
  PendingPrompt,
  Payment,
  StoredLead,
  StoredLeadSchema,
} from './schema.ts';

export {
  appendIncome,
  getCommission,
  hasIncome,
  incomeCommission,
  roundMoney,
  unpaidIncomes,
} from './money.ts';
export type { CommissionInfo } from './money.ts';

export {
  appendNote,
  canPostpone,
  createLeadStore,
  postponePatch,
  telegramIdNote,
  MAX_LIST_ROWS,
} from './store.ts';
export type { LeadStore, LeadStoreOptions, OwedRow } from './store.ts';

export type { OrderMarkers } from './orderMarkers.ts';

export {
  LOCAL_DATA_DIR,
  StorageConflictError,
  type LeadStorage,
  type StorageSnapshot,
} from './storage/types.ts';

export { createTelegramClient, parseIds } from './telegram/client.ts';
export type { TelegramClient } from './telegram/client.ts';

export {
  buildDeleteConfirm,
  canAddIncome,
  buildLeadList,
  buildMenu,
  buildOwedList,
  buildRemindPicker,
  buildSearchResults,
  buildStats,
  buildStatusKeyboard,
  createFormatter,
  EDIT_FIELD_LABELS,
  fieldChangeText,
  formatDateRu,
  formatDealsList,
  formatMoney,
  isLeadStatusKey,
  statusLabel,
  LEAD_STATUS_ACTIONS,
} from './telegram/format.ts';
export type {
  Btn,
  EditField,
  Formatter,
  FormatterOptions,
  Keyboard,
  LeadStatusKey,
  Role,
} from './telegram/format.ts';

export { createNotifier } from './telegram/notify.ts';
export type { Notifier } from './telegram/notify.ts';

export { createEnsureLeadCard, createNotifyLead } from './notifyLead.ts';
export type {
  LeadHandOff,
  NotifyLead,
  NotifyLeadOptions,
} from './notifyLead.ts';

export {
  isTrackedContactChannel,
  TRACKED_CONTACT_CHANNELS,
} from './contactChannel.ts';
export type { TrackedContactChannel } from './contactChannel.ts';

export { contactChannelSchema, HONEYPOT_FIELD, SERVICE_FIELD } from './form.ts';

export { createLeadsRoute } from './routes/leads.ts';
export type { LeadsRouteOptions, RouteRequestContext } from './routes/leads.ts';

export { secretMatches } from './verifySecret.ts';

export { createContactClickRoute } from './routes/contactClick.ts';
export type { ContactClickRouteOptions } from './routes/contactClick.ts';
