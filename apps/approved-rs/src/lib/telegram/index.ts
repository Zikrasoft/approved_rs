import {
  ADMIN_IDS as adminIds,
  OWNER_IDS as ownerIds,
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

export { ensureLeadCard };

export const {
  sendLeadNotification,
  sendPostponeReminderToOwner,
  sendDealNotificationToAdmin,
  sendCommissionClaimToAdmin,
  sendCommissionResultToOwner,
  sendStatusChangeToAdmin,
  editLeadDetailMessage,
} = notifier;

export const { buildHelp, buildLeadDetail } = formatter;

export const OWNER_IDS = ownerIds;
export const ADMIN_IDS = adminIds;

export {
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
} from '@podbor/lead-crm';

export type { Role, LeadStatusKey, Btn, Keyboard } from '@podbor/lead-crm';
