import { defineWidgetConfig } from '@medusajs/admin-sdk';
import { RocketLaunch } from '@medusajs/icons';
import { Badge, Button } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useWriting } from '../lib/admin-fetch';
import { usePublishRun } from '../lib/publish-run';

const PublishButton = () => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const { run, starting, publish } = usePublishRun();
  const running = run?.status === 'running';

  return (
    <div className="flex items-center gap-x-2">
      {run?.status === 'failed' && (
        <Link
          to="/publish"
          aria-label={t('publish.lastFailed')}
          className="inline-flex min-h-8 min-w-8 items-center justify-center"
        >
          <Badge color="red" size="2xsmall" className="whitespace-nowrap">
            <span className="max-sm:hidden">{t('publish.lastFailed')}</span>
            <span className="sm:hidden">!</span>
          </Badge>
        </Link>
      )}
      <Button
        size="small"
        onClick={publish}
        isLoading={starting || running}
        disabled={starting || running || writing}
        title={t('publish.publishSite')}
      >
        <RocketLaunch />
        <span className="max-sm:sr-only">{t('publish.publishSite')}</span>
      </Button>
    </div>
  );
};

export const config = defineWidgetConfig({ zone: 'topbar' });

export default PublishButton;
