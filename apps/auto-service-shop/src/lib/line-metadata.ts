import { listedPartSchema, type ListedPart } from '@podbor/catalog-contract';
import { z } from 'zod';

export const INSTALLATION = 'installation';
export type AddonKind = 'service' | typeof INSTALLATION;

export const LEAD_HANDOFF_ERROR = 'lead_handoff_error';
export const LEAD_HANDED_OFF_AT = 'lead_handed_off_at';
export const LEAD_HANDOFF_ATTEMPTS = 'lead_handoff_attempts';
export const LEAD_HANDOFF_MAX_ATTEMPTS = 6;
export const LEAD_OWNER_ALERTED_AT = 'lead_owner_alerted_at';

type Metadata = Record<string, unknown> | null | undefined;

const filled = z
  .string()
  .min(1)
  .nullish()
  .catch(null)
  .transform((value) => value ?? null);

const lineSchema = z
  .object({
    offer_id: filled,
    part_identifier_id: filled,
    addon_offer_id: filled,
    addon_for: filled,
    addon_kind: z
      .enum(['service', INSTALLATION])
      .nullish()
      .catch(null)
      .transform((value) => value ?? null),
    in_stock: z
      .boolean()
      .nullish()
      .catch(null)
      .transform((value) => value ?? null),
    lead_time_days: z
      .number()
      .int()
      .nonnegative()
      .nullish()
      .catch(null)
      .transform((value) => value ?? null),
  })
  .transform((line) => ({
    offerId: line.offer_id,
    partIdentifierId: line.part_identifier_id,
    parentOfferId: line.addon_offer_id,
    parentLineId: line.addon_for,
    addonKind:
      line.addon_kind ??
      (line.addon_offer_id || line.addon_for ? ('service' as const) : null),
    inStock: line.in_stock,
    leadTimeDays: line.lead_time_days,
  }));

export type Line = z.output<typeof lineSchema>;

export const readLine = (metadata: Metadata): Line =>
  lineSchema.parse(metadata ?? {});

export const listedPartOf = (metadata: Metadata, title: string): ListedPart =>
  listedPartSchema
    .catch({ slug: '', brand: '', number: '', name: title })
    .parse(metadata);

export const offerLineMetadata = (
  offerId: string,
  partIdentifierId: string,
  part: ListedPart,
) => ({ offer_id: offerId, part_identifier_id: partIdentifierId, ...part });

export const addonLineMetadata = (
  parent: { lineId: string; offerId: string },
  kind: AddonKind,
) => ({
  addon_for: parent.lineId,
  addon_offer_id: parent.offerId,
  addon_kind: kind,
});

export const withParentOffers = <T extends { id: string; metadata?: Metadata }>(
  items: T[],
): T[] =>
  items.map((item) => {
    const { parentOfferId, parentLineId } = readLine(item.metadata);
    const parent = parentOfferId
      ? undefined
      : items.find(({ id }) => id === parentLineId);
    const offerId = parent && readLine(parent.metadata).offerId;
    return offerId
      ? { ...item, metadata: { ...item.metadata, addon_offer_id: offerId } }
      : item;
  });

export const readinessMetadata = (inStock: boolean, leadTimeDays: number) => ({
  in_stock: inStock,
  lead_time_days: leadTimeDays,
});

export const withAddonsUnderParts = <T extends { metadata?: Metadata }>(
  items: T[],
): T[] => {
  const lines = items.map((item) => ({ item, line: readLine(item.metadata) }));
  const addons = lines
    .filter(({ line }) => line.addonKind)
    .sort(
      (a, b) =>
        Number(a.line.addonKind === INSTALLATION) -
        Number(b.line.addonKind === INSTALLATION),
    );
  const grouped = lines
    .filter(({ line }) => !line.addonKind)
    .flatMap((parent) => [
      parent,
      ...addons.filter(
        ({ line }) =>
          line.parentOfferId && line.parentOfferId === parent.line.offerId,
      ),
    ]);
  return [
    ...grouped,
    ...addons.filter((addon) => !grouped.includes(addon)),
  ].map(({ item }) => item);
};

const attemptsSchema = z.coerce.number().int().nonnegative().catch(0);

export const handOffAttempts = (metadata: Metadata): number =>
  attemptsSchema.parse(metadata?.[LEAD_HANDOFF_ATTEMPTS] ?? 0);

export const leadHandoff = (metadata: Metadata) => {
  const attempts = handOffAttempts(metadata);
  return {
    handed_off_at: filled.parse(metadata?.[LEAD_HANDED_OFF_AT]),
    attempts,
    error: filled.parse(metadata?.[LEAD_HANDOFF_ERROR]),
    gave_up: attempts >= LEAD_HANDOFF_MAX_ATTEMPTS,
    alerted_at: filled.parse(metadata?.[LEAD_OWNER_ALERTED_AT]),
  };
};
