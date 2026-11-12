import { Badge, Container, Select, Text } from '@medusajs/ui';
import { useRef, useState } from 'react';
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
  created: count,
  updated: count,
  unchanged: count,
  skipped: count,
  skipped_by_reason: z.object({
    brand: count,
    unmapped: count,
    excluded: count,
    currency: count,
    unreadable: count,
    no_make: count,
    not_in_scope: count,
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
  failed: z
    .array(z.object({ number: z.string(), reason: z.string() }))
    .default([]),
});

type ImportSummary = z.infer<typeof importSummarySchema>;

export const importRunSchema = z.object({
  id: z.string(),
  status: z.enum(['running', 'succeeded', 'failed']),
  error: z.string().nullable(),
  report: importSummarySchema.nullable().catch(null),
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

type ReportLine = { text: string; items?: string[] };

const withReason = ({ number, reason }: { number: string; reason: string }) =>
  `${number} (${reason})`;

const useSummaryLines = () => {
  const { t } = useTranslation('carlabAdmin');
  return (summary: ImportSummary): ReportLine[] => {
    const { skipped_by_reason: skipped } = summary;
    const counted = (key: string, count: number, items?: string[]) =>
      count > 0 && { text: t(key, { count }), items };
    return [
      {
        text: t('suppliers.importSummary', {
          ...summary,
          supplier: t(`sources.names.${summary.supplier}`, {
            defaultValue: summary.supplier,
          }),
        }),
      },
      counted('suppliers.importSkipped', skipped.brand),
      counted(
        'suppliers.importUnmapped',
        skipped.unmapped,
        summary.unmapped_categories.map(
          ({ code, count }) => `${code}: ${count}`,
        ),
      ),
      counted('suppliers.importExcluded', skipped.excluded),
      counted('suppliers.importUnreadable', skipped.unreadable),
      counted('suppliers.importNotInScope', skipped.not_in_scope),
      counted('suppliers.importWithoutPrice', skipped.currency),
      counted('suppliers.importRejected', skipped.rejected),
      counted('suppliers.importWithoutNumber', skipped.no_number),
      counted('suppliers.importWithoutEngineCode', summary.without_engine_code),
      counted(
        'suppliers.importWithoutMake',
        skipped.no_make,
        summary.unknown_makes.map(({ make, count }) => `${make}: ${count}`),
      ),
      counted('suppliers.importImagesFailed', summary.images_failed),
      counted(
        'suppliers.importMissingFields',
        summary.missing_fields.length,
        summary.missing_fields.map(
          ({ number, category, fields }) =>
            `${number} (${category}: ${fields.join(', ')})`,
        ),
      ),
      counted(
        'suppliers.importUnanswered',
        summary.unanswered.length,
        summary.unanswered.map(withReason),
      ),
      counted(
        'suppliers.importArticlesFailed',
        summary.failed.length,
        summary.failed.map(withReason),
      ),
    ].filter((line): line is ReportLine => Boolean(line));
  };
};

export const ImportRunReport = ({ run }: { run: ImportRun }) => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const summaryLines = useSummaryLines();
  const errorKey = knownError(run.error);
  const imported = importedSoFar(run.report);
  const lines: ReportLine[] =
    run.status === 'running'
      ? [
          {
            text:
              imported === null
                ? t('suppliers.importPending')
                : t('suppliers.importRunning', { count: imported }),
          },
        ]
      : [
          ...(run.report ? summaryLines(run.report) : []),
          ...[
            run.error &&
              (errorKey
                ? t(errorKey)
                : t('suppliers.importFailed', { error: run.error })),
            run.finished_at &&
              t('suppliers.importFinishedAt', {
                time: new Date(run.finished_at).toLocaleString(i18n.language),
              }),
          ]
            .filter((text): text is string => Boolean(text))
            .map((text) => ({ text })),
        ];
  return (
    <div className="flex max-w-md flex-col items-start gap-y-1 py-2">
      <Badge color={BADGE_COLOR[run.status]} size="small">
        {t(`publish.statuses.${run.status}`)}
      </Badge>
      {lines.map(({ text, items }) => (
        <div key={text} className="flex flex-col gap-y-0.5">
          <Text size="small" className="text-ui-fg-subtle">
            {text}
          </Text>
          {items && items.length > 0 && (
            <ul className="txt-small text-ui-fg-subtle max-h-40 list-disc overflow-y-auto pl-5">
              {items.map((item, index) => (
                <li key={index} className="break-words">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
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
  const chosen = useRef('');

  const choose = async (id: string) => {
    chosen.current = id;
    setSupplierId(id);
    setRuns(null);
    const data = await adminFetch(
      `/admin/suppliers/${id}/import-runs`,
      importRunsSchema,
    );
    if (chosen.current !== id) return;
    if (data) setRuns(data.import_runs);
    else setSupplierId('');
  };

  return (
    <Container className="divide-y overflow-hidden p-0">
      <ListHeader
        heading={t('suppliers.reports.heading')}
        lead={t('suppliers.reports.lead')}
      >
        <div className="max-w-xs">
          <Select value={supplierId} onValueChange={choose}>
            <Select.Trigger
              aria-label={t('suppliers.mappings.supplierPlaceholder')}
            >
              <Select.Value
                placeholder={t('suppliers.mappings.supplierPlaceholder')}
              />
            </Select.Trigger>
            <Select.Content>
              {suppliers.map(({ id, name }) => (
                <Select.Item key={id} value={id}>
                  {name}
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
