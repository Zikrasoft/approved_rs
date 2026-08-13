import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { sendLeadToSheet } from './sheets';
import type { LeadData } from './leadTypes';

const mockLead: LeadData = {
  id: 42,
  name: 'Иван',
  contact: '@ivan',
  service: 'vehicle-sourcing',
  contactChannel: 'telegram',
  comment: 'BMW X5',
  country: 'de',
  source_url: '/ru/vehicle-sourcing/de/',
  locale: 'ru',
};

function mockFetchOk(rowUrl = 'https://docs.google.com/spreadsheets/d/abc/edit#gid=0&range=A2') {
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true, rowUrl }) });
}

describe('sendLeadToSheet', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('POSTs to the configured webapp URL', async () => {
    await sendLeadToSheet(mockLead);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://script.google.com/macros/s/test/exec');
  });

  it('sends the secret and every lead field the Apps Script expects (kind omitted when not set)', async () => {
    await sendLeadToSheet(mockLead);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      secret: 'test-sheets-secret',
      id: 42,
      name: 'Иван',
      contact: '@ivan',
      contactChannel: 'telegram',
      service: 'vehicle-sourcing',
      country: 'de',
      locale: 'ru',
      comment: 'BMW X5',
      source_url: '/ru/vehicle-sourcing/de/',
    });
  });

  it('includes kind in the body when the lead specifies one', async () => {
    await sendLeadToSheet({ ...mockLead, kind: 'call_click' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.kind).toBe('call_click');
  });

  it('throws when the webapp returns a non-OK response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    await expect(sendLeadToSheet(mockLead)).rejects.toThrow();
  });

  it('returns the rowUrl from the Apps Script response', async () => {
    mockFetchOk('https://docs.google.com/spreadsheets/d/abc/edit#gid=0&range=A5');
    const result = await sendLeadToSheet(mockLead);
    expect(result).toBe('https://docs.google.com/spreadsheets/d/abc/edit#gid=0&range=A5');
  });

  it('returns null when the response has no rowUrl', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    const result = await sendLeadToSheet(mockLead);
    expect(result).toBeNull();
  });

  it('returns null when the response body is not valid JSON', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.reject(new Error('bad json')) });
    const result = await sendLeadToSheet(mockLead);
    expect(result).toBeNull();
  });
});
