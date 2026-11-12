import { Badge, Container, Select, Text } from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { adminFetch } from '../lib/admin-fetch';
import { importedSoFar } from '../lib/import-run';
import { knownError } from '../lib/run-errors';
import { ListEmpty, ListHeader, ListLoading } from './list';

const count = z.number().default(0);

const importSummarySchema = z.object({
  supplier: z.string(),
  created: z.number(),
  updated: count,
  unchanged: count,
  skipped: z.number(),
  skipped_by_reason: z.object({
    brand: z.number(),
    unmapped: count,
    excluded: count,
    currency: z.number(),
    unreadable: z.number(),
    no_make: count,
    not_in_scope: z.number(),
    rejected: count,
    no_number: count,
  }),
  without_engine_code: count,
  unmapped_categories: z
    .array(z.object({ code: z.string(), count: z.number() }))
    .default([]),
  unknown_makes: z
    .array(z.object({ make: z.string(), count: z.number() }))
    .default([]),
  missing_fields: z
    .array(
      z.object({
        number: z.string(),
        category: z.string(),
        fields: z.array(z.string()),
      }),
    )
    .default([]),
  images_failed: count,
  unanswered: z
    .array(z.object({ number: z.string(), reason: z.string() }))
    .default([]),
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
      skipped.unmapped > 0 &&
        t('suppliers.importUnmapped', {
          count: skipped.unmapped,
          categories: summary.unmapped_categories
            .map(({ code, count }) => `${code}: ${count}`)
            .join(', '),
        }),
      skipped.excluded > 0 &&
        t('suppliers.importExcluded', { count: skipped.excluded }),
      skipped.unreadable > 0 &&
        t('suppliers.importUnreadable', { count: skipped.unreadable }),
      skipped.not_in_scope > 0 &&
        t('suppliers.importNotInScope', { count: skipped.not_in_scope }),
      skipped.currency > 0 &&
        t('suppliers.importWithoutPrice', { count: skipped.currency }),
      skipped.rejected > 0 &&
        t('suppliers.importRejected', { count: skipped.rejected }),
      skipped.no_number > 0 &&
        t('suppliers.importWithoutNumber', { count: skipped.no_number }),
      summary.without_engine_code > 0 &&
        t('suppliers.importWithoutEngineCode', {
          count: summary.without_engine_code,
        }),
      skipped.no_make > 0 &&
        t('suppliers.importWithoutMake', {
          count: skipped.no_make,
          makes: summary.unknown_makes
            .map(({ make, count }) => `${make}: ${count}`)
            .join(', '),
        }),
      summary.images_failed > 0 &&
        t('suppliers.importImagesFailed', { count: summary.images_failed }),
      summary.missing_fields.length > 0 &&
        t('suppliers.importMissingFields', {
          articles: summary.missing_fields
            .map(
              ({ number, category, fields }) =>
                `${number} (${category}: ${fields.join(', ')})`,
            )
            .join('; '),
        }),
      summary.unanswered.length > 0 &&
        t('suppliers.importUnanswered', {
          articles: summary.unanswered
            .map(({ number, reason }) => `${number} (${reason})`)
            .join('; '),
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
  const imported = importedSoFar(run.report);
  const lines =
    run.status === 'running'
      ? [
          imported === null
            ? t('suppliers.importPending')
            : t('suppliers.importRunning', { count: imported }),
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
      {run.status !== 'running' && run.report?.missing_fields.length ? (
        <Link
          to="/parts?category=none"
          className="txt-small text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
        >
          {t('suppliers.importWithoutCategoryLink')}
        </Link>
      ) : null}
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
