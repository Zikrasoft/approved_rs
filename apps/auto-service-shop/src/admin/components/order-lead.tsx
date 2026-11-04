import { StatusBadge, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

export const leadSchema = z.object({
  handed_off_at: z.string().nullable(),
  attempts: z.number(),
  error: z.string().nullable(),
  gave_up: z.boolean(),
  alerted_at: z.string().nullable(),
});

type Lead = z.infer<typeof leadSchema>;

const leadState = (lead: Lead) =>
  lead.handed_off_at
    ? 'handedOff'
    : lead.gave_up
      ? lead.alerted_at
        ? 'alerted'
        : 'unalerted'
      : lead.attempts > 0
        ? 'failing'
        : 'pending';

const COLOR = {
  handedOff: 'green',
  pending: 'grey',
  failing: 'orange',
  alerted: 'red',
  unalerted: 'red',
} as const;

export const LeadStatus = ({
  lead,
  compact = false,
}: {
  lead: Lead;
  compact?: boolean;
}) => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const state = leadState(lead);
  const time = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : '';
  if (compact) {
    return (
      <StatusBadge color={COLOR[state]} className="whitespace-nowrap">
        {t(`order.lead.badge.${state}`)}
      </StatusBadge>
    );
  }
  return (
    <div className="flex flex-col gap-y-1">
      <Text size="small" weight="plus">
        {t(`order.lead.${state}`, {
          time: time(lead.handed_off_at ?? lead.alerted_at),
          count: lead.attempts,
        })}
      </Text>
      {!lead.handed_off_at && lead.error && (
        <Text size="xsmall" className="text-ui-fg-subtle break-words">
          {t('order.lead.error', { error: lead.error })}
        </Text>
      )}
    </div>
  );
};
