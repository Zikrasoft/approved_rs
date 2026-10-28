import { Badge, Container, Select, Text } from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { adminFetch } from '../lib/admin-fetch';
import { knownError } from '../lib/run-errors';
import { ListEmpty, ListHeader, ListLoading } from './list';

const importSummarySchema = z.object({
  supplier: z.string(),
  imported: z.number(),
  created: z.number(),
  skipped: z.number(),
  skipped_by_reason: z.object({
    brand: z.number(),
    currency: z.number(),
    unreadable: z.number(),
    no_engine_code: z.number(),
    not_in_scope: z.number(),
  }),
  needs_category: z.array(z.string()),
  failed: z.array(z.object({ number: z.string(), reason: z.string() })),
});

type ImportSummary = z.infer<typeof importSummarySchema>;

export const importRunSchema = z.object({
  id: z.string(),
  status: z.enum(['running', 'succeeded', 'failed']),
  error: z.string().nullable(),
  report: importSummarySchema.nullable(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
});

export type ImportRun = z.infer<typeof importRunSchema>;

const importRunsSchema = z.object({ import_runs: z.array(importRunSchema) });

const BADGE_COLOR = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
} as const;

const useSummaryLines = () => {
  const { t } = useTranslation('carlabAdmin');
  return (summary: ImportSummary) => {
    const { skipped_by_reason: skipped } = summary;
    return [
      t('suppliers.importSummary', {
        ...summary,
        supplier: t(`sources.names.${summary.supplier}`, {
          defaultValue: summary.supplier,
        }),
      }),
      skipped.brand > 0 &&
        t('suppliers.importSkipped', { count: skipped.brand }),
      skipped.unreadable > 0 &&
        t('suppliers.importUnreadable', { count: skipped.unreadable }),
      skipped.not_in_scope > 0 &&
        t('suppliers.importNotInScope', { count: skipped.not_in_scope }),
      skipped.currency > 0 &&
        t('suppliers.importWithoutPrice', { count: skipped.currency }),
      skipped.no_engine_code > 0 &&
        t('suppliers.importWithoutEngineCode', {
          count: skipped.no_engine_code,
        }),
      summary.needs_category.length > 0 &&
        t('suppliers.importWithoutCategory', {
          numbers: summary.needs_category.join(', '),
        }),
      summary.failed.length > 0 &&
        t('suppliers.importArticlesFailed', {
          articles: summary.failed
            .map(({ number, reason }) => `${number} (${reason})`)
            .join('; '),
        }),
    ].filter((line): line is string => Boolean(line));
  };
};

export const ImportRunReport = ({ run }: { run: ImportRun }) => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const summaryLines = useSummaryLines();
  const errorKey = knownError(run.error);
  const lines =
    run.status === 'running'
      ? [
          t('suppliers.importRunning', {
            count: run.report ? run.report.imported + run.report.created : 0,
          }),
        ]
      : [
          ...(run.report ? summaryLines(run.report) : []),
          run.error &&
            (errorKey
              ? t(errorKey)
              : t('suppliers.importFailed', { error: run.error })),
          run.finished_at &&
            t('suppliers.importFinishedAt', {
              time: new Date(run.finished_at).toLocaleString(i18n.language),
            }),
        ].filter((line): line is string => Boolean(line));
  return (
    <div className="flex max-w-md flex-col items-start gap-y-1 py-2">
      <Badge color={BADGE_COLOR[run.status]} size="small">
        {t(`publish.statuses.${run.status}`)}
      </Badge>
      {lines.map((line) => (
        <Text key={line} size="small" className="text-ui-fg-subtle">
          {line}
        </Text>
      ))}
    </div>
  );
};

export const ImportReports = ({
  suppliers,
}: {
  suppliers: { id: string; name: string }[];
}) => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const [supplierId, setSupplierId] = useState('');
  const [runs, setRuns] = useState<ImportRun[] | null>(null);

  const choose = async (id: string) => {
    setSupplierId(id);
    setRuns(null);
    const data = await adminFetch(
      `/admin/suppliers/${id}/import-runs`,
      importRunsSchema,
    );
    if (data) setRuns(data.import_runs);
  };

  return (
    <Container className="divide-y overflow-hidden p-0">
      <ListHeader
        heading={t('suppliers.reports.heading')}
        lead={t('suppliers.reports.lead')}
      >
        <div className="max-w-xs">
          <Select value={supplierId} onValueChange={choose}>
            <Select.Trigger>
              <Select.Value
                placeholder={t('suppliers.mappings.supplierPlaceholder')}
              />
            </Select.Trigger>
            <Select.Content>
              {suppliers.map(({ id, name }) => (
                <Select.Item key={id} value={id}>
                  {t(`sources.names.${name}`, { defaultValue: name })}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </ListHeader>
      {supplierId &&
        (!runs ? (
          <ListLoading />
        ) : runs.length ? (
          <ol className="divide-y">
            {runs.map((run) => (
              <li key={run.id} className="px-6 py-3">
                <Text size="small" weight="plus">
                  {t('suppliers.reports.startedAt', {
                    time: new Date(run.created_at).toLocaleString(
                      i18n.language,
                    ),
                  })}
                </Text>
                <ImportRunReport run={run} />
              </li>
            ))}
          </ol>
        ) : (
          <ListEmpty hint={t('suppliers.reports.empty')} />
        ))}
    </Container>
  );
};
