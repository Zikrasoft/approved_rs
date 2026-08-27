import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('./visitorCountry', () => ({ detectVisitorCountry: vi.fn() }));
vi.mock('./contactChannel', () => ({ getPreferredChannel: vi.fn() }));

const { applyRegionalContactPreference } = await import('./regionalContact');
const { detectVisitorCountry } = await import('./visitorCountry');
const { getPreferredChannel } = await import('./contactChannel');

// No jsdom in this project (node test environment) — applyRegionalContactPreference
// only calls document.querySelectorAll twice (groups, then per-group elements)
// and reads/writes `.hidden`/`.dataset`, so a hand-rolled stub covers it without
// pulling in a whole DOM implementation for one test file.
interface StubEl { dataset: { primaryChannel?: string }; hidden: boolean }

function stubDocument(groups: StubEl[][]) {
  vi.stubGlobal('document', {
    querySelectorAll: () => groups.map(els => ({ querySelectorAll: () => els })),
  });
}

describe('applyRegionalContactPreference', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(detectVisitorCountry).mockReset();
    vi.mocked(getPreferredChannel).mockReset();
  });

  it('shows only the element matching the preferred channel within each group', () => {
    vi.mocked(detectVisitorCountry).mockReturnValue('rs');
    vi.mocked(getPreferredChannel).mockReturnValue('whatsapp');
    const telegram: StubEl = { dataset: { primaryChannel: 'telegram' }, hidden: false };
    const whatsapp: StubEl = { dataset: { primaryChannel: 'whatsapp' }, hidden: true };
    stubDocument([[telegram, whatsapp]]);

    applyRegionalContactPreference();

    expect(telegram.hidden).toBe(true);
    expect(whatsapp.hidden).toBe(false);
  });

  it('applies the same channel across every [data-primary-contact] group on the page', () => {
    vi.mocked(detectVisitorCountry).mockReturnValue(undefined);
    vi.mocked(getPreferredChannel).mockReturnValue('telegram');
    const groupA: StubEl[] = [{ dataset: { primaryChannel: 'telegram' }, hidden: true }, { dataset: { primaryChannel: 'whatsapp' }, hidden: false }];
    const groupB: StubEl[] = [{ dataset: { primaryChannel: 'whatsapp' }, hidden: false }, { dataset: { primaryChannel: 'telegram' }, hidden: true }];
    stubDocument([groupA, groupB]);

    applyRegionalContactPreference();

    expect(groupA[0].hidden).toBe(false);
    expect(groupA[1].hidden).toBe(true);
    expect(groupB[0].hidden).toBe(true);
    expect(groupB[1].hidden).toBe(false);
  });
});
