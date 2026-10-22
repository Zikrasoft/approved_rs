import { defineRouteConfig } from '@medusajs/admin-sdk';
import { RocketLaunch } from '@medusajs/icons';
import { Badge, Button, Container, Heading, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { adminFetch, useWriting } from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';

const publishRunSchema = z.object({
  id: z.string(),
  status: z.enum(['running', 'succeeded', 'failed']),
  failed_step: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
  created_by_user: z
    .object({ email: z.string(), name: z.string().nullable() })
    .nullable()
    .optional(),
});

type PublishRun = z.infer<typeof publishRunSchema>;

const runResponseSchema = z.object({
  publish_run: publishRunSchema.nullable(),
});

const POLL_MS = 5000;

const KNOWN_ERRORS: Record<string, string> = {
  'OPENAI_API_KEY is not set': 'publish.knownErrors.openAiKey',
  'PUBLISH_DISPATCH_TOKEN is not set': 'publish.knownErrors.dispatchToken',
};

const BADGE_COLOR = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
} as const;

const PublishPage = () => {
  const writing = useWriting();
  const { t, i18n } = useTranslation('carlabAdmin');
  const [run, setRun] = useState<PublishRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = async () => {
    const data = await adminFetch(
      '/admin/publish-runs/latest',
      runResponseSchema,
    );
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
    setStarting(true);
    const data = await adminFetch('/admin/publish-runs', runResponseSchema, {
      method: 'POST',
    });
    setStarting(false);
    if (data) {
      toast.success(t('publish.started'));
    }
    await load();
  };

  const starter = run?.created_by_user;

  const formatTime = (value: string) =>
    new Date(value).toLocaleString(i18n.language);

  return (
    <Container className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <Heading level="h1">{t('publish.heading')}</Heading>
        <Text className="text-ui-fg-subtle">{t('publish.description')}</Text>
      </div>

      <div>
        <Button
          onClick={publish}
          isLoading={starting}
          disabled={starting || run?.status === 'running' || writing}
        >
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
          <Text size="small">
            {t('publish.startedBy', {
              who: starter
                ? (starter.name ?? starter.email)
                : t('edited.nobody'),
            })}
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
          {run.error && KNOWN_ERRORS[run.error] && (
            <Text size="small" className="text-ui-fg-error">
              {t(KNOWN_ERRORS[run.error])}
            </Text>
          )}
          {run.error && (
            <Text size="small" className="text-ui-fg-subtle break-words">
              {t('publish.errorDetails', { error: run.error })}
            </Text>
          )}
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.publish',
  icon: RocketLaunch,
  rank: 10,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.publish');

export default PublishPage;
