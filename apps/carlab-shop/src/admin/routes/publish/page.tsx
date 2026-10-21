import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminFetch } from '../../lib/admin-fetch';

type PublishRun = {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  failed_step: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

type RunResponse = { publish_run: PublishRun | null };

const POLL_MS = 5000;

const BADGE_COLOR = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
} as const;

const PublishPage = () => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const [run, setRun] = useState<PublishRun | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const data = await adminFetch<RunResponse>('/admin/publish-runs/latest');
    if (data) {
      setRun(data.publish_run);
    }
    setLoaded(true);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (run?.status !== 'running') {
      return;
    }
    const timer = setTimeout(load, POLL_MS);
    return () => clearTimeout(timer);
  }, [run]);

  const publish = async () => {
    const data = await adminFetch<RunResponse>('/admin/publish-runs', {
      method: 'POST',
    });
    if (data) {
      setRun(data.publish_run);
      toast.success(t('publish.started'));
    }
  };

  const formatTime = (value: string) =>
    new Date(value).toLocaleString(i18n.language);

  return (
    <Container className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <Heading level="h1">{t('publish.heading')}</Heading>
        <Text className="text-ui-fg-subtle">{t('publish.description')}</Text>
      </div>

      <div>
        <Button onClick={publish} disabled={run?.status === 'running'}>
          {t('publish.publish')}
        </Button>
      </div>

      {loaded && !run && <Text>{t('publish.empty')}</Text>}

      {run && (
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <Text weight="plus">{t('publish.lastRun')}</Text>
            <Badge color={BADGE_COLOR[run.status]} size="small">
              {t(`publish.statuses.${run.status}`)}
            </Badge>
          </div>
          <Text size="small">
            {t('publish.startedAt', { time: formatTime(run.created_at) })}
          </Text>
          {run.finished_at && (
            <Text size="small">
              {t('publish.finishedAt', { time: formatTime(run.finished_at) })}
            </Text>
          )}
          {run.failed_step && (
            <Text size="small" className="text-ui-fg-error">
              {t('publish.failedAt', {
                step: t(`publish.steps.${run.failed_step}`),
              })}
            </Text>
          )}
          {run.error && (
            <Text size="small" className="text-ui-fg-subtle break-words">
              {run.error}
            </Text>
          )}
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.publish',
  translationNs: 'carlabAdmin',
});

export default PublishPage;
