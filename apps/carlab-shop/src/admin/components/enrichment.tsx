import { clx, StatusBadge, Text } from '@medusajs/ui';
import { ENRICHMENT_GAPS } from '@podbor/catalog-contract';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { adminFetch, editedBySchema } from '../lib/admin-fetch';

export const enrichmentSchema = z.object({
  enriched: z.boolean(),
  reasons: z.array(z.enum(ENRICHMENT_GAPS)),
});

type Enrichment = z.infer<typeof enrichmentSchema>;

export const partIdentifierRowSchema = enrichmentSchema
  .extend(editedBySchema.shape)
  .extend({
    id: z.string(),
    value: z.string(),
    brand: z.object({ id: z.string(), name: z.string() }),
    part: z.object({ id: z.string(), name: z.string() }),
    category: z.object({ id: z.string(), name: z.string() }).nullable(),
    photos: z.number(),
    offers: z.number(),
  });

export const partIdentifiersSchema = z.object({
  part_identifiers: z.array(partIdentifierRowSchema),
  count: z.number(),
  counts: z.object({ enriched: z.number(), not_enriched: z.number() }),
});

export const EnrichmentStatus = ({
  enriched,
  reasons,
  reasonClassName,
}: Enrichment & { reasonClassName?: string }) => {
  const { t } = useTranslation('carlabAdmin');
  return (
    <div className="flex flex-col items-start gap-y-1">
      <StatusBadge color={enriched ? 'green' : 'orange'}>
        {t(enriched ? 'parts.status.enriched' : 'parts.status.notEnriched')}
      </StatusBadge>
      {reasons.map((reason) => (
        <Text
          key={reason}
          size="xsmall"
          className={clx('text-ui-fg-subtle', reasonClassName)}
        >
          {t(`parts.reasons.${reason}`)}
        </Text>
      ))}
    </div>
  );
};

export const PartEnrichment = ({
  partId,
  version = 0,
}: {
  partId: string;
  version?: string | number;
}) => {
  const [status, setStatus] = useState<Enrichment | null>(null);

  useEffect(() => {
    adminFetch(
      `/admin/part-identifiers?part_id=${encodeURIComponent(partId)}&limit=1`,
      partIdentifiersSchema,
    ).then((data) => setStatus(data?.part_identifiers[0] ?? null));
  }, [partId, version]);

  return status && <EnrichmentStatus {...status} />;
};
