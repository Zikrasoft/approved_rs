import type { TrackedContactChannel } from '@podbor/lead-crm/contact-channel';

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

const WHATSAPP_FIRST: readonly TrackedContactChannel[] = [
  'whatsapp',
  'telegram',
  'viber',
  'phone',
];
const TELEGRAM_FIRST: readonly TrackedContactChannel[] = [
  'telegram',
  'whatsapp',
  'viber',
  'phone',
];

const CHANNELS_BY_COUNTRY = new Map<string, readonly TrackedContactChannel[]>([
  ['rs', WHATSAPP_FIRST],
  ['ba', WHATSAPP_FIRST],
  ['hr', WHATSAPP_FIRST],
  ['me', WHATSAPP_FIRST],
  ['mk', WHATSAPP_FIRST],
  ['tr', WHATSAPP_FIRST],
  ['de', WHATSAPP_FIRST],
  ['es', WHATSAPP_FIRST],
  ['pt', WHATSAPP_FIRST],
  ['ch', WHATSAPP_FIRST],
  ['fr', WHATSAPP_FIRST],
  ['it', WHATSAPP_FIRST],
  ['pl', WHATSAPP_FIRST],
  ['ru', TELEGRAM_FIRST],
  ['ua', TELEGRAM_FIRST],
  ['by', TELEGRAM_FIRST],
  ['kz', TELEGRAM_FIRST],
]);

export interface ContactRanking {
  byCountry: ReadonlyMap<string, readonly TrackedContactChannel[]>;
  fallback: readonly TrackedContactChannel[];
}

const DEFAULT_RANKING: ContactRanking = {
  byCountry: CHANNELS_BY_COUNTRY,
  fallback: TELEGRAM_FIRST,
};

export function detectVisitorCountry(): string | undefined {
  try {
    return TIMEZONE_COUNTRY.get(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  } catch {
    return undefined;
  }
}

export function preferredContactChannels(
  countryCode: string | undefined,
  locale?: string,
  { byCountry, fallback }: ContactRanking = DEFAULT_RANKING,
): readonly TrackedContactChannel[] {
  if (locale?.toLowerCase().split('-')[0] === 'ru') return TELEGRAM_FIRST;
  return (countryCode && byCountry.get(countryCode.toLowerCase())) || fallback;
}

function visitorChannels(
  ranking?: ContactRanking,
): readonly TrackedContactChannel[] {
  return preferredContactChannels(
    detectVisitorCountry(),
    document.documentElement.lang,
    ranking,
  );
}

export function visitorChannel(
  ranking?: ContactRanking,
): TrackedContactChannel {
  return visitorChannels(ranking)[0];
}

function rankedIn<T>(
  ranking: readonly TrackedContactChannel[],
  items: T[],
  channelOf: (item: T) => string | undefined,
): T[] {
  return ranking.flatMap((channel) =>
    items.filter((item) => channelOf(item) === channel),
  );
}

function showOne(
  group: HTMLElement,
  ranking: readonly TrackedContactChannel[],
) {
  const options = Array.from(
    group.querySelectorAll<HTMLElement>('[data-primary-channel]'),
  );
  const [shown] = rankedIn(ranking, options, (el) => el.dataset.primaryChannel);
  if (!shown) return;
  const channel = shown.dataset.primaryChannel;
  options.forEach((el) => {
    el.hidden = el.dataset.primaryChannel !== channel;
  });
}

function promoteAheadOfRunnerUp(
  group: HTMLElement,
  ranking: readonly TrackedContactChannel[],
) {
  const [preferred, runnerUp] = rankedIn(
    ranking,
    Array.from(group.querySelectorAll<HTMLElement>('[data-channel]')),
    (el) => el.dataset.channel,
  );
  if (
    runnerUp &&
    preferred.compareDocumentPosition(runnerUp) &
      Node.DOCUMENT_POSITION_PRECEDING
  ) {
    runnerUp.before(preferred);
  }
}

let armed = false;

export function applyContactPreference(ranking?: ContactRanking): void {
  if (armed) return;
  armed = true;
  const channels = visitorChannels(ranking);
  document
    .querySelectorAll<HTMLElement>('[data-primary-contact]')
    .forEach((group) => showOne(group, channels));
  document
    .querySelectorAll<HTMLElement>('[data-contact-order]')
    .forEach((group) => promoteAheadOfRunnerUp(group, channels));
}
