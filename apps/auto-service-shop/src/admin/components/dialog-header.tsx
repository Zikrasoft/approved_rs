import { XMark } from '@medusajs/icons';
import { Drawer, FocusModal, IconButton, Kbd } from '@medusajs/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const CloseButton = ({ close }: { close: typeof Drawer.Close }) => {
  const { t } = useTranslation('carlabAdmin');
  const Close = close;
  return (
    <Close asChild>
      <IconButton
        size="small"
        type="button"
        variant="transparent"
        aria-label={t('common.close')}
      >
        <XMark />
      </IconButton>
    </Close>
  );
};

export const DrawerHeader = ({ children }: { children: ReactNode }) => (
  <div className="border-ui-border-base flex items-start justify-between gap-x-4 border-b px-6 py-4">
    <div className="flex flex-col gap-y-1">{children}</div>
    <div className="flex items-center gap-x-2">
      <Kbd>esc</Kbd>
      <CloseButton close={Drawer.Close} />
    </div>
  </div>
);

export const ModalHeader = () => (
  <div className="border-ui-border-base flex items-center gap-x-2 border-b px-4 py-2">
    <CloseButton close={FocusModal.Close} />
    <Kbd>esc</Kbd>
  </div>
);
