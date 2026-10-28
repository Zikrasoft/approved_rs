import { toast, usePrompt } from '@medusajs/ui';
import { useEffect, useSyncExternalStore } from 'react';
import { getI18n, useTranslation } from 'react-i18next';
import { z } from 'zod';

import { adminFetch } from './admin-fetch';

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

export type PublishRun = z.infer<typeof publishRunSchema>;

const runResponseSchema = z.object({
  publish_run: publishRunSchema.nullable(),
});

const POLL_MS = 5000;

type PublishState = {
  run: PublishRun | null;
  loaded: boolean;
  starting: boolean;
};

let state: PublishState = { run: null, loaded: false, starting: false };
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const setState = (next: Partial<PublishState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const load = async () => {
  clearTimeout(timer);
  const data = await adminFetch(
    '/admin/publish-runs/latest',
    runResponseSchema,
  );
  setState({ loaded: true, ...(data && { run: data.publish_run }) });
  if (state.run?.status === 'running') {
    timer = setTimeout(load, POLL_MS);
  }
};

const publish = async () => {
  setState({ starting: true });
  const data = await adminFetch('/admin/publish-runs', runResponseSchema, {
    method: 'POST',
  });
  setState({ starting: false });
  if (data) {
    toast.success(getI18n().t('publish.started', { ns: 'carlabAdmin' }));
  }
  await load();
};

export const usePublishRun = () => {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const prompt = usePrompt();
  const { t } = useTranslation('carlabAdmin');
  useEffect(() => {
    load();
  }, []);
  const confirmAndPublish = async () => {
    if (
      await prompt({
        variant: 'confirmation',
        title: t('publish.confirmTitle'),
        description: t('publish.confirmBody'),
        confirmText: t('publish.publish'),
        cancelText: t('common.cancel'),
      })
    ) {
      await publish();
    }
  };
  return { ...snapshot, publish: confirmAndPublish };
};
