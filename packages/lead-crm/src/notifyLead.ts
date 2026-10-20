import {
  isClosed,
  type LeadInput,
  type LeadSubmission,
  type StoredLead,
} from './schema.ts';
import type { LeadStore } from './store.ts';
import type { Role } from './telegram/markup.ts';
import type { Notifier } from './telegram/notify.ts';

interface EnsureLeadCardOptions {
  store: Pick<LeadStore, 'setTelegramMessage'>;
  notifier: Pick<Notifier, 'sendLeadNotification' | 'refreshLeadCard'>;
}

export function createEnsureLeadCard({
  store,
  notifier,
}: EnsureLeadCardOptions) {
  return async function ensureLeadCard(lead: StoredLead): Promise<void> {
    if (await notifier.refreshLeadCard(lead)) return;
    if (lead.status === 'lost') return;
    const { chatId, messageId } = await notifier.sendLeadNotification(lead);
    try {
      const saved = await store.setTelegramMessage(lead.id, chatId, messageId);
      if (!saved)
        console.error('[lead-crm] no lead row to attach the group card to', {
          leadId: lead.id,
          messageId,
        });
    } catch (err) {
      console.error('[lead-crm] failed to persist the group card id', {
        error: err,
        leadId: lead.id,
        messageId,
      });
    }
  };
}

interface EnsureLeadTopicOptions {
  store: Pick<LeadStore, 'setTopic' | 'setTopicSummary'>;
  notifier: Pick<
    Notifier,
    | 'openLeadTopic'
    | 'deleteLeadTopic'
    | 'postLeadTopicSummary'
    | 'refreshLeadTopic'
  >;
}

export function createEnsureLeadTopic({
  store,
  notifier,
}: EnsureLeadTopicOptions) {
  async function summarise(
    opened: StoredLead,
    topicId: number,
  ): Promise<StoredLead> {
    if (opened.topicMessageId != null) {
      await notifier.refreshLeadTopic(opened);
      return opened;
    }
    const messageId = await notifier.postLeadTopicSummary(opened, topicId);
    return (await store.setTopicSummary(opened.id, messageId)) ?? opened;
  }

  async function dropDuplicate(lead: StoredLead, topicId: number) {
    await notifier.deleteLeadTopic(topicId).catch((error: unknown) => {
      console.error('[lead-crm] could not delete a duplicate topic', {
        error,
        leadId: lead.id,
        topicId,
      });
    });
  }

  return async function ensureLeadTopic(lead: StoredLead): Promise<StoredLead> {
    if (lead.telegramId == null) return lead;
    if (lead.topicId != null) return summarise(lead, lead.topicId);
    const topicId = await notifier.openLeadTopic(lead);
    const stored = await store.setTopic(lead.id, topicId);
    if (!stored) return lead;
    if (stored.topicId === topicId) return summarise(stored, topicId);
    await dropDuplicate(lead, topicId);
    return stored;
  };
}

interface LeadTopicStateOptions {
  store: Pick<LeadStore, 'touchTopic' | 'closeTopic'>;
  notifier: Pick<Notifier, 'reopenLeadTopic' | 'closeLeadTopic'>;
}

export function createTouchLeadTopic({
  store,
  notifier,
}: LeadTopicStateOptions) {
  return async function touchLeadTopic(lead: StoredLead): Promise<StoredLead> {
    if (lead.topicId == null) return lead;
    if (lead.topicClosed) {
      try {
        await notifier.reopenLeadTopic(lead);
      } catch (error) {
        console.error('[lead-crm] could not reopen the topic', {
          error,
          leadId: lead.id,
        });
        return lead;
      }
    }
    return (await store.touchTopic(lead.id)) ?? lead;
  };
}

export function createCloseLeadTopic({
  store,
  notifier,
}: LeadTopicStateOptions) {
  return async function closeLeadTopic(lead: StoredLead): Promise<boolean> {
    if (lead.topicId == null || lead.topicClosed) return false;
    try {
      await notifier.closeLeadTopic(lead);
      await store.closeTopic(lead.id);
      return true;
    } catch (error) {
      console.error('[lead-crm] could not close the topic', {
        error,
        leadId: lead.id,
      });
      return false;
    }
  };
}

export interface StatusChangeOptions {
  surface?: { chatId: number; messageId: number; role: Role };
  author?: { role: Role; id: number };
}

interface AfterStatusChangeOptions {
  ensureLeadCard: (lead: StoredLead) => Promise<void>;
  ensureLeadTopic: (lead: StoredLead) => Promise<StoredLead>;
  closeLeadTopic: (lead: StoredLead) => Promise<boolean>;
  notifier: Pick<
    Notifier,
    'editLeadDetailMessage' | 'sendStatusChange' | 'unpinLeadCard'
  >;
  dropFromDigest: (leadId: number) => Promise<void>;
}

export function createDropFromDigest({
  store,
  notifier,
}: {
  store: Pick<LeadStore, 'takeFromDigest'>;
  notifier: Pick<Notifier, 'editDigest'>;
}) {
  return async function dropFromDigest(leadId: number): Promise<void> {
    const left = await store.takeFromDigest(leadId);
    if (!left) return;
    try {
      await notifier.editDigest(left);
    } catch (error) {
      console.error('[lead-crm] could not redraw the digest', {
        error,
        leadId,
      });
    }
  };
}

export function createAfterStatusChange({
  ensureLeadCard,
  ensureLeadTopic,
  closeLeadTopic,
  notifier,
  dropFromDigest,
}: AfterStatusChangeOptions) {
  async function refreshTopic(lead: StoredLead): Promise<StoredLead> {
    if (lead.topicId == null) return lead;
    return ensureLeadTopic(lead).catch((error: unknown) => {
      console.error('[lead-crm] could not refresh the topic summary', {
        error,
        leadId: lead.id,
      });
      return lead;
    });
  }

  return async function afterStatusChange(
    lead: StoredLead,
    { surface, author }: StatusChangeOptions = {},
  ): Promise<void> {
    await ensureLeadCard(lead);
    const current = await refreshTopic(lead);
    if (isClosed(lead)) {
      await notifier.unpinLeadCard(lead);
      await closeLeadTopic(current);
    }
    if (surface)
      await notifier.editLeadDetailMessage(
        surface.chatId,
        surface.messageId,
        lead,
        surface.role,
      );
    if (!author) return;
    await notifier.sendStatusChange(lead, author.role, author.id);
    await dropFromDigest(lead.id);
  };
}

export interface NotifyLeadOptions {
  store: Pick<
    LeadStore,
    'insertOrMergeLead' | 'setTelegramMessage' | 'newStoredLead'
  >;
  notifier: Pick<Notifier, 'sendLeadNotification' | 'refreshLeadCard'>;
  brand: string;
}

export type LeadHandOff = Pick<StoredLead, 'brand'>;

export interface NotifyLeadResult {
  stored: boolean;
  delivered: boolean;
}

export type NotifyLead = (
  data: LeadSubmission,
  logPrefix: string,
  handOff?: LeadHandOff,
) => Promise<NotifyLeadResult>;

function leadTrace(data: LeadInput) {
  return { brand: data.brand, service: data.service, kind: data.kind };
}

export function createNotifyLead({
  store,
  notifier,
  brand,
}: NotifyLeadOptions): NotifyLead {
  return async function notifyLead(submission, logPrefix, handOff) {
    const data = { ...submission, brand, ...handOff };
    console.log(`${logPrefix} notifyLead started`, leadTrace(data));

    let lead: StoredLead;
    let merged = false;
    let stored = true;
    try {
      ({ lead, merged } = await store.insertOrMergeLead(data));
    } catch (err) {
      console.error(
        `${logPrefix} store insertLead failed, notifying without CRM tracking`,
        { error: err, ...leadTrace(data) },
      );
      stored = false;
      try {
        lead = store.newStoredLead(data, Date.now());
      } catch (fallbackErr) {
        console.error(`${logPrefix} lead failed validation, cannot notify`, {
          error: fallbackErr,
          ...leadTrace(data),
        });
        return { stored, delivered: false };
      }
    }

    if (merged) {
      console.log(`${logPrefix} merged into an existing open lead`, {
        leadId: lead.id,
      });
      try {
        await notifier.refreshLeadCard(lead);
      } catch (err) {
        console.error(`${logPrefix} failed to refresh the merged lead's card`, {
          error: err,
          leadId: lead.id,
        });
      }
      console.log(`${logPrefix} notifyLead finished`);
      return { stored, delivered: true };
    }

    try {
      const { chatId, messageId } = await notifier.sendLeadNotification(lead);
      console.log(`${logPrefix} Telegram notification succeeded`);
      try {
        await store.setTelegramMessage(lead.id, chatId, messageId);
      } catch (err) {
        console.error(`${logPrefix} failed to persist telegram message id`, {
          error: err,
          leadId: lead.id,
        });
      }
      console.log(`${logPrefix} notifyLead finished`);
      return { stored, delivered: true };
    } catch (err) {
      console.error(`${logPrefix} Telegram notification failed`, {
        error: err,
        leadId: lead.id,
        ...leadTrace(lead),
      });
    }

    console.log(`${logPrefix} notifyLead finished`);
    return { stored, delivered: false };
  };
}
