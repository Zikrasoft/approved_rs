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
  bot,
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
  sendPayoutNotificationToAdmin,
  sendSettlementToOwner,
  sendStatusChangeToAdmin,
  editLeadDetailMessage,
  unpinLeadCard,
} = notifier;

export const { buildHelp, buildLeadDetail } = formatter;

export const OWNER_IDS = ownerIds;
export const ADMIN_IDS = adminIds;

export {
  canAddIncome,
  formatMoney,
  formatDateRu,
  buildToPay,
  buildSearchResults,
  buildMenu,
  buildOpenList,
  buildStats,
  buildDeleteConfirm,
  buildRemindPicker,
  REPLY_COPY,
  PAYOUT_COPY,
  payoutRecordedMessage,
  OUTCOME_COPY,
  SETTLEMENT_COPY,
  settleKeyboard,
  settlementText,
  DRAFT_COPY,
  draftMessage,
  escapeHtml,
} from '@podbor/lead-crm';

export type { Role, Btn, Keyboard } from '@podbor/lead-crm';
