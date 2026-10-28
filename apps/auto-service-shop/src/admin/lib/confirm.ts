import { toast, usePrompt } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';

type Confirmation = {
  title: string;
  description: string;
  confirmText?: string;
  done?: string | (() => string);
  run: () => Promise<unknown>;
};

export const useConfirmed = () => {
  const prompt = usePrompt();
  const { t } = useTranslation('carlabAdmin');
  return async ({
    title,
    description,
    confirmText,
    done,
    run,
  }: Confirmation): Promise<boolean> => {
    const confirmed = await prompt({
      title,
      description,
      confirmText: confirmText ?? t('common.delete'),
      cancelText: t('common.cancel'),
    });
    if (!confirmed || !(await run())) {
      return false;
    }
    toast.success(
      typeof done === 'function' ? done() : (done ?? t('common.deleted')),
    );
    return true;
  };
};
