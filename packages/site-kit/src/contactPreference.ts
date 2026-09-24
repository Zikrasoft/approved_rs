import type { TrackedContactChannel } from '@podbor/lead-crm/contact-channel';

// TODO: two channels only — a third (Viber, Instagram) taking the first slot
// needs a preference list here and an insertBefore walk in
// applyPreferredContactOrder, not another literal. applyPrimaryContactChannel
// is stricter still: it hides every data-primary-channel it does not match, so
// a third channel in such a group disappears for everyone until that list exists.
export type PreferredContactChannel = Extract<
  TrackedContactChannel,
  'telegram' | 'whatsapp'
>;

const TIMEZONE_COUNTRY = new Map<string, string>([
  ['Europe/Belgrade', 'rs'],
  ['Europe/Berlin', 'de'],
  ['Europe/Madrid', 'es'],
  ['Europe/Moscow', 'ru'],
  ['Europe/Kyiv', 'ua'],
  ['Europe/Kiev', 'ua'],
  ['Europe/Minsk', 'by'],
  ['Asia/Almaty', 'kz'],
  ['Asia/Aqtobe', 'kz'],
  ['Asia/Qyzylorda', 'kz'],
  ['Europe/Sarajevo', 'ba'],
  ['Europe/Zagreb', 'hr'],
  ['Europe/Podgorica', 'me'],
  ['Europe/Skopje', 'mk'],
  ['Europe/Istanbul', 'tr'],
]);

const PREFERRED_CHANNEL_BY_COUNTRY = new Map<string, PreferredContactChannel>([
  ['rs', 'whatsapp'],
  ['ba', 'whatsapp'],
  ['hr', 'whatsapp'],
  ['me', 'whatsapp'],
  ['mk', 'whatsapp'],
  ['tr', 'whatsapp'],
  ['de', 'whatsapp'],
  ['es', 'whatsapp'],
  ['pt', 'whatsapp'],
  ['ch', 'whatsapp'],
  ['fr', 'whatsapp'],
  ['it', 'whatsapp'],
  ['pl', 'whatsapp'],
  ['ru', 'telegram'],
  ['ua', 'telegram'],
  ['by', 'telegram'],
  ['kz', 'telegram'],
]);

export function detectVisitorCountry(): string | undefined {
  try {
    return TIMEZONE_COUNTRY.get(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  } catch {
    return undefined;
  }
}

export function preferredContactChannel(
  countryCode: string | undefined,
  locale?: string,
): PreferredContactChannel {
  if (locale?.toLowerCase().split('-')[0] === 'ru') return 'telegram';
  return (
    (countryCode &&
      PREFERRED_CHANNEL_BY_COUNTRY.get(countryCode.toLowerCase())) ||
    'telegram'
  );
}

function visitorChannel(): PreferredContactChannel {
  return preferredContactChannel(
    detectVisitorCountry(),
    document.documentElement.lang,
  );
}

export function applyPrimaryContactChannel(): void {
  const channel = visitorChannel();
  document
    .querySelectorAll<HTMLElement>('[data-primary-contact]')
    .forEach((group) => {
      group
        .querySelectorAll<HTMLElement>('[data-primary-channel]')
        .forEach((el) => {
          el.hidden = el.dataset.primaryChannel !== channel;
        });
    });
}

export function applyPreferredContactOrder(): void {
  const channel = visitorChannel();
  const other = channel === 'telegram' ? 'whatsapp' : 'telegram';
  document
    .querySelectorAll<HTMLElement>('[data-contact-order]')
    .forEach((group) => {
      const preferred = group.querySelector<HTMLElement>(
        `[data-channel="${channel}"]`,
      );
      const demoted = group.querySelector<HTMLElement>(
        `[data-channel="${other}"]`,
      );
      if (!preferred || !demoted) return;
      const alreadyFirst = !(
        demoted.compareDocumentPosition(preferred) &
        Node.DOCUMENT_POSITION_FOLLOWING
      );
      if (!alreadyFirst) demoted.before(preferred);
      const choice = preferred.querySelector<HTMLInputElement>(
        'input[type="radio"]',
      );
      const demotedChoice = demoted.querySelector<HTMLInputElement>(
        'input[type="radio"]',
      );
      if (choice && demotedChoice?.checked) choice.checked = true;
    });
}
