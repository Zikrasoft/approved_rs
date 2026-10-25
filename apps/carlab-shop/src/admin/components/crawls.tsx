import {
  Button,
  Container,
  Input,
  StatusBadge,
  Text,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { adminFetch, useWriting } from '../lib/admin-fetch';
import { ListEmpty, ListHeader, ListLoading } from './list';

const POLL_MS = 5000;

const crawlSchema = z.object({
  key: z.string(),
  supplier: z.string(),
  status: z.enum(['idle', 'running', 'paused', 'done']),
  paused_reason: z
    .enum([
      'robots_unavailable',
      'sitemap_unavailable',
      'blocked',
      'server_errors',
    ])
    .nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  pages: z.object({
    queued: z.number(),
    done: z.number(),
    failed: z.number(),
    gone: z.number(),
  }),
  failures: z.record(
    z.enum(['blocked', 'robots', 'network', 'server', 'http']),
    z.number(),
  ),
});

type Crawl = z.infer<typeof crawlSchema>;

const crawlsSchema = z.object({ crawls: z.array(crawlSchema) });
const startedSchema = z.object({ started: z.string() });

const BADGE = {
  idle: 'grey',
  running: 'blue',
  paused: 'orange',
  done: 'green',
} as const;

const ACTION = {
  idle: 'start',
  running: 'start',
  paused: 'resume',
  done: 'restart',
} as const;

const CrawlRow = ({
  crawl,
  onStart,
  starting,
}: {
  crawl: Crawl;
  onStart: (limit: number | null) => void;
  starting: boolean;
}) => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const [limit, setLimit] = useState('');
  const writing = useWriting();
  const number = (value: number) => value.toLocaleString(i18n.language);
  const date = (iso: string) => new Date(iso).toLocaleString(i18n.language);
  const { queued, done, failed, gone } = crawl.pages;
  const total = queued + done + failed + gone;
  const share = total ? (done + failed + gone) / total : 0;

  return (
    <div className="flex flex-col gap-y-3 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-x-3">
          <Text size="small" weight="plus">
            {crawl.supplier}
          </Text>
          <StatusBadge color={BADGE[crawl.status]}>
            {t(`crawls.status.${crawl.status}`)}
          </StatusBadge>
        </div>
        <div className="flex items-center gap-x-2">
          <Input
            type="number"
            size="small"
            className="w-28"
            min={1}
            step={1}
            placeholder={t('crawls.limitPlaceholder')}
            aria-label={t('crawls.limitLabel', { supplier: crawl.supplier })}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          />
          <Button
            size="small"
            variant="secondary"
            isLoading={starting}
            disabled={crawl.status === 'running' || writing}
            aria-label={t('crawls.startLabel', { supplier: crawl.supplier })}
            onClick={() => onStart(limit ? Number(limit) : null)}
          >
            {t(`crawls.${ACTION[crawl.status]}`)}
          </Button>
        </div>
      </div>
      {total > 0 && (
        <div className="flex flex-col gap-y-2">
          <div
            role="progressbar"
            aria-label={t('crawls.progressLabel', { supplier: crawl.supplier })}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done + failed + gone}
            className="bg-ui-bg-component h-2 overflow-hidden rounded-full"
          >
            <div
              className={
                crawl.status === 'paused'
                  ? 'bg-ui-tag-orange-icon h-full'
                  : 'bg-ui-fg-interactive h-full'
              }
              style={{ width: `${share * 100}%` }}
            />
          </div>
          <div className="text-ui-fg-subtle flex flex-wrap gap-x-4 gap-y-1">
            <Text size="small">
              {t('crawls.done', { done: number(done), total: number(total) })}
            </Text>
            <Text size="small">
              {t('crawls.queued', { value: number(queued) })}
            </Text>
            {failed > 0 && (
              <Text size="small">
                {t('crawls.failed', { value: number(failed) })} (
                {Object.entries(crawl.failures)
                  .filter(([, value]) => value > 0)
                  .map(([reason, value]) =>
                    t(`crawls.failures.${reason}`, { value: number(value) }),
                  )
                  .join(', ')}
                )
              </Text>
            )}
            {gone > 0 && (
              <Text size="small">
                {t('crawls.gone', { value: number(gone) })}
              </Text>
            )}
          </div>
        </div>
      )}
      {crawl.status === 'paused' && crawl.paused_reason && (
        <Text size="small" className="text-ui-fg-error">
          {t(`crawls.pausedReasons.${crawl.paused_reason}`)}
        </Text>
      )}
      {crawl.status === 'done' && crawl.finished_at ? (
        <Text size="small" className="text-ui-fg-muted">
          {t('crawls.finishedAt', { date: date(crawl.finished_at) })}
        </Text>
      ) : (
        crawl.started_at && (
          <Text size="small" className="text-ui-fg-muted">
            {t('crawls.startedAt', { date: date(crawl.started_at) })}
          </Text>
        )
      )}
    </div>
  );
};

export const Crawls = () => {
  const { t } = useTranslation('carlabAdmin');
  const [crawls, setCrawls] = useState<Crawl[] | null>(null);
  const [startingKey, setStartingKey] = useState<string | null>(null);

  const load = async () => {
    const data = await adminFetch('/admin/crawls', crawlsSchema);
    if (data) setCrawls(data.crawls);
  };

  useEffect(() => {
    load();
  }, []);

  const running = crawls?.some(({ status }) => status === 'running') ?? false;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [running]);

  const start = async (crawl: Crawl, limit: number | null) => {
    setStartingKey(crawl.key);
    const started = await adminFetch(
      `/admin/crawls/${crawl.key}`,
      startedSchema,
      { method: 'POST', body: JSON.stringify(limit ? { limit } : {}) },
    );
    setStartingKey(null);
    if (started) {
      toast.success(t('crawls.started', { supplier: crawl.supplier }));
      await load();
    }
  };

  return (
    <Container className="divide-y overflow-hidden p-0">
      <ListHeader heading={t('crawls.heading')} lead={t('crawls.lead')} />
      {!crawls ? (
        <ListLoading />
      ) : crawls.length ? (
        crawls.map((crawl) => (
          <CrawlRow
            key={crawl.key}
            crawl={crawl}
            starting={startingKey === crawl.key}
            onStart={(limit) => start(crawl, limit)}
          />
        ))
      ) : (
        <ListEmpty hint={t('crawls.empty')} />
      )}
    </Container>
  );
};
