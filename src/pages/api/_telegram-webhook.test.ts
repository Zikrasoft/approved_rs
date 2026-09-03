import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import type { StoredLead } from '@/lib/store';

vi.mock('@/lib/telegram', () => ({
  isLeadStatusKey: (key: string) => ['in_progress', 'won', 'lost'].includes(key),
  answerCallback: vi.fn(),
  refreshLeadCard: vi.fn(),
  sendForceReplyPrompt: vi.fn(),
  formatMoney: (n: number) => `${n} €`,
  sendDealNotificationToAdmin: vi.fn(),
  sendCommissionClaimToAdmin: vi.fn(),
  sendCommissionResultToOwner: vi.fn(),
  sendMessage: vi.fn(),
  buildOwedList: vi.fn().mockReturnValue({ text: 'OWED_LIST', reply_markup: { inline_keyboard: [] } }),
  formatDealsList: vi.fn().mockReturnValue('DEALS_LIST'),
  formatSearchResults: vi.fn().mockReturnValue('SEARCH_RESULTS'),
  buildMenu: vi.fn((role: string) => ({ text: `MENU_${role}`, reply_markup: { inline_keyboard: [] } })),
  buildLeadList: vi.fn((_leads: unknown[], status: string) => ({ text: `LIST_${status}`, reply_markup: { inline_keyboard: [] } })),
  buildStats: vi.fn().mockReturnValue('STATS'),
  buildLeadDetail: vi.fn((lead: { id: number }, role: string) => ({ text: `DETAIL_${lead.id}_${role}`, reply_markup: { inline_keyboard: [] } })),
  editLeadDetailMessage: vi.fn(),
}));

vi.mock('@/lib/store', () => ({
  getLead: vi.fn(),
  setStatus: vi.fn(),
  archiveLead: vi.fn(),
  unarchiveLead: vi.fn(),
  toggleCustomerPaid: vi.fn(),
  confirmCommissionPayment: vi.fn(),
  rejectCommissionPayment: vi.fn(),
  setPendingPrompt: vi.fn(),
  findByPendingPrompt: vi.fn(),
  resolvePendingPrompt: vi.fn(),
  searchLeads: vi.fn(),
  getOwedSummary: vi.fn(),
  readLeads: vi.fn(),
  getCommission: vi.fn(),
}));

import { POST } from './telegram-webhook';
import {
  answerCallback, refreshLeadCard, sendForceReplyPrompt, sendDealNotificationToAdmin,
  sendCommissionClaimToAdmin, sendCommissionResultToOwner, sendMessage, buildLeadDetail, editLeadDetailMessage,
} from '@/lib/telegram';
import {
  getLead, setStatus, archiveLead, unarchiveLead, toggleCustomerPaid, confirmCommissionPayment,
  rejectCommissionPayment, setPendingPrompt, findByPendingPrompt, resolvePendingPrompt, searchLeads,
  getOwedSummary, readLeads, getCommission,
} from '@/lib/store';

const SECRET = 'test-webhook-secret';
const OWNER_ID = 111;
const ADMIN_ID = 222;
const OTHER_ID = 999;
const DM_CHAT_ID = 111; // a DM chat — prompts/detail views only ever live here now, never the group

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return {
    id: 5,
    name: 'Иван',
    contact: '@ivan',
    service: 'vehicle-sourcing',
    locale: 'ru',
    status: 'in_progress',
    dealAmount: null,
    commissionPercent: 10,
    paidAmount: 0,
    payments: [],
    telegramChatId: -100123,
    telegramMessageId: 555,
    statusChangedAt: '2026-01-01T00:00:00.000Z',
    lastRemindedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    pendingPrompt: null,
    archived: false,
    customerPaidAt: null,
    pendingCommissionClaim: null,
    ...overrides,
  };
}

// Makes the mocked resolvePendingPrompt actually apply its patch callback
// against a given base lead, so assertions can inspect the resulting
// StoredLead the way the real store.ts primitive would produce it.
function mockResolveFromBase(base: StoredLead) {
  vi.mocked(resolvePendingPrompt).mockImplementation(async (_c, _m, apply) => ({ ...base, ...apply(base) }));
}

function makeCtx(body: unknown, headers: Record<string, string> = { 'x-telegram-bot-api-secret-token': SECRET }) {
  return {
    request: new Request('http://localhost/api/telegram-webhook', { method: 'POST', headers, body: JSON.stringify(body) }),
  } as Pick<APIContext, 'request'> as APIContext;
}

function makeRawCtx(rawBody: string) {
  return {
    request: new Request('http://localhost/api/telegram-webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': SECRET },
      body: rawBody,
    }),
  } as Pick<APIContext, 'request'> as APIContext;
}

describe('POST /api/telegram-webhook', () => {
  beforeEach(() => {
    vi.mocked(getLead).mockReset().mockResolvedValue(makeLead());
    vi.mocked(setStatus).mockReset().mockResolvedValue(makeLead({ status: 'lost' }));
    vi.mocked(archiveLead).mockReset().mockResolvedValue(makeLead({ archived: true }));
    vi.mocked(unarchiveLead).mockReset().mockResolvedValue(makeLead({ archived: false }));
    vi.mocked(toggleCustomerPaid).mockReset().mockResolvedValue(makeLead({ customerPaidAt: '2026-01-02T00:00:00.000Z' }));
    vi.mocked(confirmCommissionPayment).mockReset().mockResolvedValue(makeLead({ status: 'won', dealAmount: 100000, paidAmount: 4000 }));
    vi.mocked(rejectCommissionPayment).mockReset().mockResolvedValue(makeLead({ status: 'won', dealAmount: 100000 }));
    vi.mocked(setPendingPrompt).mockReset().mockResolvedValue(makeLead());
    vi.mocked(findByPendingPrompt).mockReset().mockResolvedValue(undefined);
    vi.mocked(resolvePendingPrompt).mockReset().mockResolvedValue(undefined);
    vi.mocked(searchLeads).mockReset().mockResolvedValue([]);
    vi.mocked(getOwedSummary).mockReset().mockResolvedValue({ rows: [], total: 0 });
    vi.mocked(readLeads).mockReset().mockResolvedValue([]);
    vi.mocked(getCommission).mockReset().mockReturnValue({ commission: 10000, remaining: 10000, isPaidOff: false });
    vi.mocked(answerCallback).mockReset().mockResolvedValue(undefined);
    vi.mocked(refreshLeadCard).mockReset().mockResolvedValue(undefined);
    vi.mocked(editLeadDetailMessage).mockReset().mockResolvedValue(undefined);
    vi.mocked(sendForceReplyPrompt).mockReset().mockResolvedValue(888);
    vi.mocked(sendDealNotificationToAdmin).mockReset().mockResolvedValue(undefined);
    vi.mocked(sendCommissionClaimToAdmin).mockReset().mockResolvedValue(undefined);
    vi.mocked(sendCommissionResultToOwner).mockReset().mockResolvedValue(undefined);
    vi.mocked(sendMessage).mockReset().mockResolvedValue(undefined);
  });

  it('rejects a request without the secret token header', async () => {
    const res = await POST(makeCtx({}, {}));
    expect(res.status).toBe(401);
    expect(getLead).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong secret token', async () => {
    const res = await POST(makeCtx({}, { 'x-telegram-bot-api-secret-token': 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('acks with 200 on a malformed JSON body instead of throwing, so Telegram stops retrying', async () => {
    const res = await POST(makeRawCtx('not json'));
    expect(res.status).toBe(200);
    expect(getLead).not.toHaveBeenCalled();
  });

  describe('trust boundary — callbacks are gated on from.id, not chat', () => {
    it('rejects a status callback from someone who is neither owner nor admin', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-x', data: 'st:5:lost', from: { id: OTHER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(setStatus).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-x');
    });
  });

  describe('status callbacks (st:<id>:<key>)', () => {
    it('sets status directly for in_progress/lost and refreshes both surfaces', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-1', data: 'st:5:lost', from: { id: OWNER_ID }, message: { message_id: 555, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(setStatus).toHaveBeenCalledWith(5, 'lost');
      expect(refreshLeadCard).toHaveBeenCalled();
      expect(editLeadDetailMessage).toHaveBeenCalledWith(DM_CHAT_ID, 555, expect.objectContaining({ status: 'lost' }), 'owner');
      expect(answerCallback).toHaveBeenCalledWith('cb-1', 'Статус обновлён');
    });

    it('starts a deal-amount prompt on "won" instead of setting status directly, when no amount is set yet', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-2', data: 'st:5:won', from: { id: OWNER_ID }, message: { message_id: 555, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(setStatus).not.toHaveBeenCalled();
      expect(sendForceReplyPrompt).toHaveBeenCalledWith(DM_CHAT_ID, expect.stringContaining('заработал'));
      expect(setPendingPrompt).toHaveBeenCalledWith(5, { chatId: DM_CHAT_ID, messageId: 888, kind: 'deal_amount' });
      expect(answerCallback).toHaveBeenCalledWith('cb-2', 'Жду сумму');
    });

    it('blocks a second "won" tap while a deal-amount prompt is already pending, instead of orphaning the first one', async () => {
      vi.mocked(getLead).mockResolvedValue(makeLead({
        id: 5, dealAmount: null,
        pendingPrompt: { chatId: DM_CHAT_ID, messageId: 500, kind: 'deal_amount' },
      }));

      const res = await POST(makeCtx({
        callback_query: { id: 'cb-2b', data: 'st:5:won', from: { id: OWNER_ID }, message: { message_id: 555, chat: { id: DM_CHAT_ID } } },
      }));

      expect(res.status).toBe(200);
      expect(sendForceReplyPrompt).not.toHaveBeenCalled();
      expect(setPendingPrompt).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-2b', expect.stringContaining('Уже ждём'));
    });

    it('does nothing when the lead is not found', async () => {
      vi.mocked(getLead).mockResolvedValue(undefined);
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-3', data: 'st:99:in_progress', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(setStatus).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-3');
    });

    it('acks without updating for an unrecognized status key', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-4', data: 'st:5:bogus', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(setStatus).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-4');
    });

    it('acks with an error message and does not throw if setStatus fails', async () => {
      vi.mocked(setStatus).mockRejectedValueOnce(new Error('down'));
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-5', data: 'st:5:lost', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(answerCallback).toHaveBeenCalledWith('cb-5', 'Ошибка, попробуйте ещё раз');
    });
  });

  describe('archive / unarchive', () => {
    it('arch:<id> archives and refreshes both surfaces', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-6', data: 'arch:5', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(archiveLead).toHaveBeenCalledWith(5);
      expect(refreshLeadCard).toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-6', 'Архивировано');
    });

    it('unarch:<id> restores and refreshes both surfaces', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-7', data: 'unarch:5', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(unarchiveLead).toHaveBeenCalledWith(5);
      expect(answerCallback).toHaveBeenCalledWith('cb-7', 'Восстановлено');
    });
  });

  describe('custpaid:<id> — owner only', () => {
    it('owner can toggle', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-8', data: 'custpaid:5', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(toggleCustomerPaid).toHaveBeenCalledWith(5);
    });

    it('admin cannot', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-9', data: 'custpaid:5', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(toggleCustomerPaid).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-9');
    });
  });

  describe('claimpay:<id> — owner only', () => {
    it('owner starts a commission-claim prompt when a balance remains', async () => {
      vi.mocked(getLead).mockResolvedValue(makeLead({ id: 9, status: 'won', dealAmount: 100000 }));
      vi.mocked(getCommission).mockReturnValue({ commission: 10000, remaining: 10000, isPaidOff: false });

      const res = await POST(makeCtx({
        callback_query: { id: 'cb-10', data: 'claimpay:9', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));

      expect(res.status).toBe(200);
      expect(sendForceReplyPrompt).toHaveBeenCalledWith(DM_CHAT_ID, expect.stringContaining('10000'));
      expect(setPendingPrompt).toHaveBeenCalledWith(9, { chatId: DM_CHAT_ID, messageId: 888, kind: 'commission_claim' });
    });

    it('acks without a prompt once nothing remains', async () => {
      vi.mocked(getLead).mockResolvedValue(makeLead({ id: 9, status: 'won', dealAmount: 100000, paidAmount: 10000 }));
      vi.mocked(getCommission).mockReturnValue({ commission: 10000, remaining: 0, isPaidOff: true });

      const res = await POST(makeCtx({
        callback_query: { id: 'cb-11', data: 'claimpay:9', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));

      expect(res.status).toBe(200);
      expect(sendForceReplyPrompt).not.toHaveBeenCalled();
    });

    it('admin cannot claim', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-12', data: 'claimpay:9', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendForceReplyPrompt).not.toHaveBeenCalled();
    });

    it('blocks a second tap while a prompt is already pending, instead of orphaning the first one', async () => {
      vi.mocked(getLead).mockResolvedValue(makeLead({
        id: 9, status: 'won', dealAmount: 100000,
        pendingPrompt: { chatId: DM_CHAT_ID, messageId: 500, kind: 'commission_claim' },
      }));
      vi.mocked(getCommission).mockReturnValue({ commission: 10000, remaining: 10000, isPaidOff: false });

      const res = await POST(makeCtx({
        callback_query: { id: 'cb-12b', data: 'claimpay:9', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));

      expect(res.status).toBe(200);
      expect(sendForceReplyPrompt).not.toHaveBeenCalled();
      expect(setPendingPrompt).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-12b', expect.stringContaining('Уже ждём'));
    });
  });

  describe('confirmpay: / rejectpay: — admin only', () => {
    it('admin confirms: moves the money and tells the owner', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-13', data: 'confirmpay:5', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(confirmCommissionPayment).toHaveBeenCalledWith(5);
      expect(sendCommissionResultToOwner).toHaveBeenCalledWith(expect.objectContaining({ paidAmount: 4000 }), true);
    });

    it('admin rejects: clears the claim and tells the owner', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-14', data: 'rejectpay:5', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(rejectCommissionPayment).toHaveBeenCalledWith(5);
      expect(sendCommissionResultToOwner).toHaveBeenCalledWith(expect.anything(), false);
    });

    it('owner cannot confirm or reject', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-15', data: 'confirmpay:5', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(confirmCommissionPayment).not.toHaveBeenCalled();
    });

    it('does not notify the owner a second time when confirm is a no-op (duplicate delivery)', async () => {
      vi.mocked(confirmCommissionPayment).mockResolvedValue(undefined);
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-15b', data: 'confirmpay:5', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendCommissionResultToOwner).not.toHaveBeenCalled();
      expect(refreshLeadCard).not.toHaveBeenCalled();
    });

    it('does not notify the owner a second time when reject is a no-op (duplicate delivery)', async () => {
      vi.mocked(rejectCommissionPayment).mockResolvedValue(undefined);
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-15c', data: 'rejectpay:5', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendCommissionResultToOwner).not.toHaveBeenCalled();
      expect(refreshLeadCard).not.toHaveBeenCalled();
    });
  });

  describe('edit:<id>:<field>', () => {
    it('starts a field-edit prompt', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-16', data: 'edit:5:contact', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendForceReplyPrompt).toHaveBeenCalledWith(DM_CHAT_ID, expect.stringContaining('контакт'));
      expect(setPendingPrompt).toHaveBeenCalledWith(5, { chatId: DM_CHAT_ID, messageId: 888, kind: 'edit_contact' });
    });
  });

  describe('list: / open: / menu:stats', () => {
    it('list:<status> sends the filtered list', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-17', data: 'list:new', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(DM_CHAT_ID, 'LIST_new', { reply_markup: { inline_keyboard: [] } });
    });

    it('open:<id> sends the detail view for the tapper\'s role', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-18', data: 'open:5', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(buildLeadDetail).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }), 'admin');
      expect(sendMessage).toHaveBeenCalledWith(DM_CHAT_ID, 'DETAIL_5_admin', { reply_markup: { inline_keyboard: [] } });
    });

    it('open:<id> for a missing lead just acks', async () => {
      vi.mocked(getLead).mockResolvedValue(undefined);
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-19', data: 'open:404', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('menu:stats sends the stats view', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-20', data: 'menu:stats', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(DM_CHAT_ID, 'STATS');
    });
  });

  describe('menu:debt — both roles', () => {
    it('shows the owed list to the admin', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-21', data: 'menu:debt', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: ADMIN_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(ADMIN_ID, 'OWED_LIST', { reply_markup: { inline_keyboard: [] } });
    });

    it('shows the same owed list to the owner', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-21b', data: 'menu:debt', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: OWNER_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(OWNER_ID, 'OWED_LIST', { reply_markup: { inline_keyboard: [] } });
    });
  });

  describe('menu:deals — admin only', () => {
    it('shows the deals list to the admin', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-22', data: 'menu:deals', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: ADMIN_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(ADMIN_ID, 'DEALS_LIST');
    });

    it('ignores menu:deals from the owner', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-22b', data: 'menu:deals', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: OWNER_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendMessage).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-22b');
    });
  });

  it('acks an unrecognized callback without touching any lead', async () => {
    const res = await POST(makeCtx({
      callback_query: { id: 'cb-23', data: 'unknown:thing', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: 1 } } },
    }));
    expect(res.status).toBe(200);
    expect(getLead).not.toHaveBeenCalled();
    expect(answerCallback).toHaveBeenCalledWith('cb-23');
  });

  it('acks without acting when a callback has no message attached', async () => {
    const res = await POST(makeCtx({ callback_query: { id: 'cb-24', data: 'st:5:won', from: { id: OWNER_ID } } }));
    expect(res.status).toBe(200);
    expect(getLead).not.toHaveBeenCalled();
    expect(answerCallback).toHaveBeenCalledWith('cb-24');
  });

  describe('malformed callback_data — none of these should reach a handler', () => {
    it('non-numeric id in st: falls through to unrecognized', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-25', data: 'st:abc:won', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(getLead).not.toHaveBeenCalled();
      expect(setStatus).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-25');
    });

    it('non-numeric id in arch: falls through to unrecognized', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-26', data: 'arch:xx', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(archiveLead).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-26');
    });

    it('unlisted edit field falls through to unrecognized', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-27', data: 'edit:5:bogus', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(sendForceReplyPrompt).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-27');
    });

    it('unlisted list status falls through to unrecognized', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-28', data: 'list:archived', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(readLeads).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-28');
    });

    it('an empty callback_data string is unrecognized, not misparsed as any route', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-29', data: '', from: { id: OWNER_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(getLead).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-29');
    });

    it('the retired pay: route (superseded by claimpay:/confirmpay:) no longer does anything', async () => {
      const res = await POST(makeCtx({
        callback_query: { id: 'cb-30', data: 'pay:5', from: { id: ADMIN_ID }, message: { message_id: 1, chat: { id: DM_CHAT_ID } } },
      }));
      expect(res.status).toBe(200);
      expect(confirmCommissionPayment).not.toHaveBeenCalled();
      expect(sendForceReplyPrompt).not.toHaveBeenCalled();
      expect(answerCallback).toHaveBeenCalledWith('cb-30');
    });
  });

  describe('/start in a private chat', () => {
    it('shows the owner menu to TELEGRAM_OWNER_ID', async () => {
      const res = await POST(makeCtx({ message: { message_id: 1, text: '/start', chat: { id: OWNER_ID, type: 'private' }, from: { id: OWNER_ID } } }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(OWNER_ID, 'MENU_owner', { reply_markup: { inline_keyboard: [] } });
    });

    it('shows the admin menu to TELEGRAM_ADMIN_ID', async () => {
      const res = await POST(makeCtx({ message: { message_id: 1, text: '/start', chat: { id: ADMIN_ID, type: 'private' }, from: { id: ADMIN_ID } } }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(ADMIN_ID, 'MENU_admin', { reply_markup: { inline_keyboard: [] } });
    });

    it('denies /start from anyone else', async () => {
      const res = await POST(makeCtx({ message: { message_id: 1, text: '/start', chat: { id: OTHER_ID, type: 'private' }, from: { id: OTHER_ID } } }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(OTHER_ID, '⛔ Доступ запрещён.');
    });

    it('/start lead_<id> opens the lead detail directly for an authorized sender', async () => {
      vi.mocked(getLead).mockResolvedValue(makeLead({ id: 5 }));
      const res = await POST(makeCtx({ message: { message_id: 1, text: '/start lead_5', chat: { id: OWNER_ID, type: 'private' }, from: { id: OWNER_ID } } }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(OWNER_ID, 'DETAIL_5_owner', { reply_markup: { inline_keyboard: [] } });
    });

    it('/start lead_<id> for an unknown lead falls back to the menu', async () => {
      vi.mocked(getLead).mockResolvedValue(undefined);
      const res = await POST(makeCtx({ message: { message_id: 1, text: '/start lead_404', chat: { id: OWNER_ID, type: 'private' }, from: { id: OWNER_ID } } }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(OWNER_ID, 'MENU_owner', { reply_markup: { inline_keyboard: [] } });
    });

    it('/start lead_<id> denies an unauthorized sender even with a valid payload', async () => {
      const res = await POST(makeCtx({ message: { message_id: 1, text: '/start lead_5', chat: { id: OTHER_ID, type: 'private' }, from: { id: OTHER_ID } } }));
      expect(res.status).toBe(200);
      expect(getLead).not.toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(OTHER_ID, '⛔ Доступ запрещён.');
    });
  });

  describe('/menu — same as bare /start, never takes a payload', () => {
    it('shows the owner menu', async () => {
      const res = await POST(makeCtx({ message: { message_id: 1, text: '/menu', chat: { id: OWNER_ID, type: 'private' }, from: { id: OWNER_ID } } }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(OWNER_ID, 'MENU_owner', { reply_markup: { inline_keyboard: [] } });
    });

    it('shows the admin menu', async () => {
      const res = await POST(makeCtx({ message: { message_id: 1, text: '/menu', chat: { id: ADMIN_ID, type: 'private' }, from: { id: ADMIN_ID } } }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(ADMIN_ID, 'MENU_admin', { reply_markup: { inline_keyboard: [] } });
    });

    it('denies an unauthorized sender', async () => {
      const res = await POST(makeCtx({ message: { message_id: 1, text: '/menu', chat: { id: OTHER_ID, type: 'private' }, from: { id: OTHER_ID } } }));
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(OTHER_ID, '⛔ Доступ запрещён.');
    });
  });

  describe('replying to a pending force_reply prompt', () => {
    it('completes the deal, refreshes the group card, and notifies the admin on a valid deal-amount reply', async () => {
      const lead = makeLead({ id: 5, pendingPrompt: { chatId: DM_CHAT_ID, messageId: 888, kind: 'deal_amount' } });
      vi.mocked(findByPendingPrompt).mockResolvedValue(lead);
      mockResolveFromBase(lead);

      const res = await POST(makeCtx({
        message: { message_id: 2, text: '150000', chat: { id: DM_CHAT_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 888 } },
      }));

      expect(res.status).toBe(200);
      expect(resolvePendingPrompt).toHaveBeenCalledWith(DM_CHAT_ID, 888, expect.any(Function));
      const updated = vi.mocked(refreshLeadCard).mock.calls[0][0];
      expect(updated.dealAmount).toBe(150000);
      expect(updated.status).toBe('won');
      expect(sendDealNotificationToAdmin).toHaveBeenCalled();
    });

    it('rejects a non-numeric deal-amount reply without resolving the prompt', async () => {
      vi.mocked(findByPendingPrompt).mockResolvedValue(makeLead({ id: 5, pendingPrompt: { chatId: DM_CHAT_ID, messageId: 888, kind: 'deal_amount' } }));

      const res = await POST(makeCtx({
        message: { message_id: 2, text: 'много', chat: { id: DM_CHAT_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 888 } },
      }));

      expect(res.status).toBe(200);
      expect(resolvePendingPrompt).not.toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(DM_CHAT_ID, expect.stringContaining('число'));
    });

    it('rejects a negative amount instead of silently making it positive', async () => {
      vi.mocked(findByPendingPrompt).mockResolvedValue(makeLead({ id: 5, pendingPrompt: { chatId: DM_CHAT_ID, messageId: 888, kind: 'deal_amount' } }));

      const res = await POST(makeCtx({
        message: { message_id: 2, text: '-500', chat: { id: DM_CHAT_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 888 } },
      }));

      expect(res.status).toBe(200);
      expect(resolvePendingPrompt).not.toHaveBeenCalled();
    });

    it('rejects a zero amount (must be strictly positive)', async () => {
      vi.mocked(findByPendingPrompt).mockResolvedValue(makeLead({ id: 5, pendingPrompt: { chatId: DM_CHAT_ID, messageId: 888, kind: 'deal_amount' } }));

      const res = await POST(makeCtx({
        message: { message_id: 2, text: '0', chat: { id: DM_CHAT_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 888 } },
      }));

      expect(res.status).toBe(200);
      expect(resolvePendingPrompt).not.toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(DM_CHAT_ID, expect.stringContaining('число'));
    });

    it('rejects empty/whitespace text as an amount reply', async () => {
      vi.mocked(findByPendingPrompt).mockResolvedValue(makeLead({ id: 5, pendingPrompt: { chatId: DM_CHAT_ID, messageId: 888, kind: 'deal_amount' } }));

      const res = await POST(makeCtx({
        message: { message_id: 2, text: '   ', chat: { id: DM_CHAT_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 888 } },
      }));

      expect(res.status).toBe(200);
      expect(resolvePendingPrompt).not.toHaveBeenCalled();
    });

    it('records a commission claim on a valid reply and notifies the admin', async () => {
      const lead = makeLead({ id: 5, pendingPrompt: { chatId: DM_CHAT_ID, messageId: 888, kind: 'commission_claim' } });
      vi.mocked(findByPendingPrompt).mockResolvedValue(lead);
      mockResolveFromBase(lead);

      const res = await POST(makeCtx({
        message: { message_id: 2, text: '4000', chat: { id: DM_CHAT_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 888 } },
      }));

      expect(res.status).toBe(200);
      const updated = vi.mocked(sendCommissionClaimToAdmin).mock.calls[0][0];
      expect(updated.pendingCommissionClaim).toEqual({ amount: 4000, claimedAt: expect.any(String) });
    });

    it('rejects a commission claim larger than the actual remaining balance', async () => {
      // beforeEach's default getCommission mock returns remaining: 10000
      vi.mocked(findByPendingPrompt).mockResolvedValue(makeLead({ id: 5, pendingPrompt: { chatId: DM_CHAT_ID, messageId: 888, kind: 'commission_claim' } }));

      const res = await POST(makeCtx({
        message: { message_id: 2, text: '20000', chat: { id: DM_CHAT_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 888 } },
      }));

      expect(res.status).toBe(200);
      expect(resolvePendingPrompt).not.toHaveBeenCalled();
      expect(sendCommissionClaimToAdmin).not.toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(DM_CHAT_ID, expect.stringContaining('остатка'));
    });

    it('accepts a claim exactly equal to the remaining balance', async () => {
      const lead = makeLead({ id: 5, pendingPrompt: { chatId: DM_CHAT_ID, messageId: 888, kind: 'commission_claim' } });
      vi.mocked(findByPendingPrompt).mockResolvedValue(lead);
      mockResolveFromBase(lead);

      const res = await POST(makeCtx({
        message: { message_id: 2, text: '10000', chat: { id: DM_CHAT_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 888 } },
      }));

      expect(res.status).toBe(200);
      expect(sendCommissionClaimToAdmin).toHaveBeenCalled();
    });

    it('edit:name reply updates the field, refreshes the card, and confirms', async () => {
      const lead = makeLead({ id: 5, name: 'Old', pendingPrompt: { chatId: DM_CHAT_ID, messageId: 888, kind: 'edit_name' } });
      vi.mocked(findByPendingPrompt).mockResolvedValue(lead);
      mockResolveFromBase(lead);

      const res = await POST(makeCtx({
        message: { message_id: 2, text: 'Новое Имя', chat: { id: DM_CHAT_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 888 } },
      }));

      expect(res.status).toBe(200);
      const updated = vi.mocked(refreshLeadCard).mock.calls[0][0];
      expect(updated.name).toBe('Новое Имя');
      expect(sendMessage).toHaveBeenCalledWith(DM_CHAT_ID, '✅ Обновлено');
    });

    it('rejects an empty edit value for name/contact', async () => {
      vi.mocked(findByPendingPrompt).mockResolvedValue(makeLead({ id: 5, pendingPrompt: { chatId: DM_CHAT_ID, messageId: 888, kind: 'edit_name' } }));

      const res = await POST(makeCtx({
        message: { message_id: 2, text: '   ', chat: { id: DM_CHAT_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 888 } },
      }));

      expect(res.status).toBe(200);
      expect(resolvePendingPrompt).not.toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(DM_CHAT_ID, expect.stringContaining('пустым'));
    });

    it('ignores a reply that matches no pending prompt', async () => {
      vi.mocked(findByPendingPrompt).mockResolvedValue(undefined);
      const res = await POST(makeCtx({
        message: { message_id: 2, text: 'random reply', chat: { id: OWNER_ID, type: 'private' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 42 } },
      }));
      expect(res.status).toBe(200);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('reply correlation is attempted regardless of chat type (not gated behind private-only) — defense in depth', async () => {
      vi.mocked(findByPendingPrompt).mockResolvedValue(undefined);
      const res = await POST(makeCtx({
        message: { message_id: 2, text: 'random', chat: { id: -100999, type: 'group' }, from: { id: OWNER_ID }, reply_to_message: { message_id: 42 } },
      }));
      expect(res.status).toBe(200);
      expect(findByPendingPrompt).toHaveBeenCalledWith(-100999, 42);
    });
  });

  describe('plain DM text (search)', () => {
    it('treats plain DM text from the owner as a search query', async () => {
      const res = await POST(makeCtx({ message: { message_id: 3, text: 'Иван', chat: { id: OWNER_ID, type: 'private' }, from: { id: OWNER_ID } } }));
      expect(res.status).toBe(200);
      expect(searchLeads).toHaveBeenCalledWith('Иван');
      expect(sendMessage).toHaveBeenCalledWith(OWNER_ID, 'SEARCH_RESULTS');
    });

    it('denies plain DM text from an unknown user', async () => {
      const res = await POST(makeCtx({ message: { message_id: 3, text: 'hi', chat: { id: OTHER_ID, type: 'private' }, from: { id: OTHER_ID } } }));
      expect(res.status).toBe(200);
      expect(searchLeads).not.toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith(OTHER_ID, '⛔ Доступ запрещён.');
    });
  });

  it('ignores group chatter that is not a button press or a prompt reply', async () => {
    const res = await POST(makeCtx({ message: { message_id: 4, text: 'hi everyone', chat: { id: -100123, type: 'group' }, from: { id: OWNER_ID } } }));
    expect(res.status).toBe(200);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
