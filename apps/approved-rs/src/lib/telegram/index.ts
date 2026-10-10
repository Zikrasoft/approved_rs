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
  sendDigest,
  sendPayoutNotificationToAdmin,
  sendSettlementToOwner,
  sendOperationNotice,
  sendMonthlySummary,
  sendStatusChangeToAdmin,
  editLeadDetailMessage,
  unpinLeadCard,
} = notifier;

export const { buildHelp, buildLeadDetail } = formatter;

export const OWNER_IDS = ownerIds;
export const ADMIN_IDS = adminIds;

export {
  formatMoney,
  formatDateRu,
  buildToPay,
  buildSearchResults,
  buildMenu,
  buildBalance,
  LEDGER_COPY,
  operationRecordedText,
  operationRefusedText,
  reAskOperationText,
  buildOpenList,
  buildStats,
  buildDeleteConfirm,
  buildRemindPicker,
  REPLY_COPY,
  PAYOUT_COPY,
  payoutRecordedMessage,
  OUTCOME_COPY,
  LEAD_ACTION_COPY,
  SETTLEMENT_COPY,
  settleKeyboard,
  settlementText,
  escapeHtml,
} from '@podbor/lead-crm';

export type { Role, Btn, Keyboard } from '@podbor/lead-crm';
