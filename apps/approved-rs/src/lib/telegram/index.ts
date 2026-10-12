import {
  adminIds,
  ownerIds,
  afterStatusChange,
  client,
  ensureLeadCard,
  ensureLeadTopic,
  formatter,
  groupId,
  notifier,
  touchLeadTopic,
  closeLeadTopic,
} from '@/lib/crmBot';

export const {
  bot,
  sendMessage,
  sendForceReplyPrompt,
  answerCallback,
  safeEditMessage,
} = client;

export {
  afterStatusChange,
  closeLeadTopic,
  ensureLeadCard,
  ensureLeadTopic,
  touchLeadTopic,
};

export const {
  sendLeadNotification,
  sendDigest,
  sendPostponeReminder,
  sendOperationNotice,
  sendStatusChangeToAdmin,
  sendFieldChange,
  sendNoteNotice,
  renameLeadTopic,
  editLeadDetailMessage,
  unpinLeadCard,
} = notifier;

export const { buildHelp, buildLeadDetail } = formatter;

export const OWNER_IDS = ownerIds;
export const ADMIN_IDS = adminIds;
export const GROUP_ID = groupId;

export {
  formatMoney,
  formatDateRu,
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
  LEAD_ACTION_COPY,
  EDIT_COPY,
  noteLine,
  extraContactNote,
  reAskEditText,
  escapeHtml,
} from '@podbor/lead-crm';

export type { Role, Btn, Keyboard, EditField } from '@podbor/lead-crm';
