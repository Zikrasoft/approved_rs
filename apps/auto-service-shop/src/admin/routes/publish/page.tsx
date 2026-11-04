import { defineRouteConfig } from '@medusajs/admin-sdk';
import { RocketLaunch } from '@medusajs/icons';
import { Badge, Button, Container, Heading, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';

import { useWriting } from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { usePublishRun } from '../../lib/publish-run';
import { knownError } from '../../lib/run-errors';

const BADGE_COLOR = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
} as const;

const PublishPage = () => {
  const writing = useWriting();
  const { t, i18n } = useTranslation('carlabAdmin');
  const { run, loaded, starting, publish } = usePublishRun();

  const starter = run?.created_by_user;
  const knownErrorKey = knownError(run?.error ?? null);

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
          {knownErrorKey && (
            <Text size="small" className="text-ui-fg-error">
              {t(knownErrorKey)}
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
