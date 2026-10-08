import {
  adminIds,
  ownerIds,
  afterStatusChange,
  client,
  ensureLeadCard,
  formatter,
  notifier,
} from '@/lib/crmBot';

export const {
  sendMessage,
  sendForceReplyPrompt,
  answerCallback,
  safeEditMessage,
} = client;

export { afterStatusChange, ensureLeadCard };

export const {
  sendLeadNotification,
  sendPostponeReminderToOwner,
  sendDealNotificationToAdmin,
  sendIncomeNotificationToAdmin,
  sendCommissionClaimToAdmin,
  sendCommissionResultToOwner,
  sendStatusChangeToAdmin,
  sendFieldChangeToAdmin,
  editLeadDetailMessage,
} = notifier;

export const { buildHelp, buildLeadDetail } = formatter;

export const OWNER_IDS = ownerIds;
export const ADMIN_IDS = adminIds;

export {
  canAddIncome,
  isLeadStatusKey,
  statusLabel,
  formatMoney,
  formatDateRu,
  buildStatusKeyboard,
  buildOwedList,
  formatDealsList,
  buildSearchResults,
  buildMenu,
  buildLeadList,
  buildStats,
  buildDeleteConfirm,
  buildRemindPicker,
  LEAD_STATUS_ACTIONS,
  EDIT_COPY,
  EDIT_FIELD_LABELS,
  REPLY_COPY,
  escapeHtml,
} from '@podbor/lead-crm';

export type {
  Role,
  LeadStatusKey,
  Btn,
  Keyboard,
  EditField,
} from '@podbor/lead-crm';
