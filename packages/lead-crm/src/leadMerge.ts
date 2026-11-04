import { serviceLabel } from '@podbor/brands';
import { channelLabel } from './channelLabels.ts';
import { isTelegramIdContact } from './contactShape.ts';
import type { LeadInput, StoredLead } from './schema.ts';
import {
  datedNote,
  extraContactNote,
  isDatedNote,
  otherNameNote,
  visitorNote,
} from './notes.ts';
import { notPlacedReasonOf, PARTS_ORDER_COPY } from './partsOrderCopy.ts';

const MAX_STORED_COMMENT_LENGTH = 4000;

export function isPlaceholderContact(contact: string): boolean {
  return contact === '' || contact === '—';
}

function contactRank(contact: string): number {
  if (isPlaceholderContact(contact)) return 0;
  return isTelegramIdContact(contact) ? 1 : 2;
}

export function hasRealContact(contact: string): boolean {
  return contactRank(contact) === 2;
}

export function appendNote(
  comment: string | null | undefined,
  note: string,
): string {
  const next = comment && note ? `${comment}\n${note}` : comment || note;
  return next.slice(-MAX_STORED_COMMENT_LENGTH);
}

type Identity = Pick<LeadInput, 'name' | 'contact' | 'contactChannel'>;

function whoseIdentity(
  existing: StoredLead,
  data: LeadInput,
  takesOver: boolean,
): { kept: Identity; displaced: Identity; upgraded: boolean } {
  const upgraded =
    takesOver || contactRank(data.contact) > contactRank(existing.contact);
  return upgraded
    ? { kept: data, displaced: existing, upgraded }
    : { kept: existing, displaced: data, upgraded };
}

function displacedNotes(
  kept: Identity,
  displaced: Identity,
  at: Date,
): string[] {
  const signed = (text: string) =>
    visitorNote(text, displaced.contactChannel, at);
  return [
    hasRealContact(displaced.contact) && displaced.contact !== kept.contact
      ? signed(extraContactNote(displaced.contact))
      : '',
    kept.name && displaced.name && displaced.name !== kept.name
      ? signed(otherNameNote(displaced.name))
      : '',
  ].filter(Boolean);
}

function absorbedFailedCheckout(
  failed: string | null | undefined,
  order: string | null | undefined,
  at: Date,
): string {
  const lines = failed?.split('\n') ?? [];
  const reasons = new Set(
    lines.map(notPlacedReasonOf).filter((reason) => reason != null),
  );
  return [
    order ?? '',
    ...[...reasons].map((reason) =>
      datedNote(PARTS_ORDER_COPY.earlierNotPlaced(reason), at),
    ),
    ...lines.filter(isDatedNote),
  ]
    .filter(Boolean)
    .join('\n');
}

function triedLabel(data: LeadInput, existing: StoredLead): string {
  const had = new Set([existing.service, ...existing.services]);
  const services = (data.services?.length ? data.services : [data.service])
    .filter(Boolean)
    .filter((service) => !had.has(service));
  if (services.length) return services.map(serviceLabel).join(', ');
  if (data.service) return '';
  return data.kind === 'call_click' && data.contactChannel
    ? channelLabel(data.contactChannel)
    : '';
}

const newLines = (
  comment: string | null | undefined,
  added: string | null | undefined,
): string[] => {
  const held = new Set(comment?.split('\n'));
  return (added?.trim().split('\n') ?? []).filter((line) => !held.has(line));
};

export function mergedLead(
  existing: StoredLead,
  data: LeadInput,
  { takesOver, at }: { takesOver: boolean; at: Date },
): StoredLead {
  const { kept, displaced, upgraded } = whoseIdentity(
    existing,
    data,
    takesOver,
  );
  const botHandOff =
    (data.telegramId ?? existing.telegramId) != null &&
    data.contactChannel === existing.contactChannel;
  const tried = botHandOff ? '' : triedLabel(data, existing);
  const clickedFirst =
    upgraded &&
    !botHandOff &&
    existing.kind === 'call_click' &&
    existing.contactChannel
      ? channelLabel(existing.contactChannel)
      : null;
  return {
    ...existing,
    ...(upgraded
      ? {
          contact: data.contact,
          contactChannel: data.contactChannel ?? existing.contactChannel,
          service: data.service || existing.service,
          services: data.services?.length ? data.services : existing.services,
          kind: data.kind ?? existing.kind,
        }
      : {}),
    name: kept.name || displaced.name,
    source_url: existing.source_url ?? data.source_url,
    orderId: existing.orderId ?? data.orderId,
    telegramId: data.telegramId ?? existing.telegramId,
    referredBy: data.referredBy ?? existing.referredBy,
    adSource: existing.adSource ?? data.adSource ?? null,
    metaIds: existing.metaIds ?? data.metaIds ?? null,
    capturePrompt: data.capturePrompt ?? existing.capturePrompt,
    visitorActiveAt:
      data.telegramId == null ? existing.visitorActiveAt : at.toISOString(),
    comment: appendNote(
      takesOver
        ? absorbedFailedCheckout(existing.comment, data.comment, at)
        : existing.comment,
      [
        clickedFirst ? `Сначала кликнул: ${clickedFirst}` : '',
        tried ? `Также пробовал: ${tried}` : '',
        ...(takesOver
          ? []
          : data.orderId
            ? [data.comment]
            : newLines(existing.comment, data.comment)),
        ...displacedNotes(kept, displaced, at),
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  };
}
