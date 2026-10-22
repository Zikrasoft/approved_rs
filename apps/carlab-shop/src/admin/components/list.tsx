import { EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import { clx, DropdownMenu, Heading, IconButton, Text } from '@medusajs/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export const LIST_TABLE =
  '[&_thead]:border-t-0 [&_td:first-child]:pl-6 [&_th:first-child]:pl-6';

export const ListHeader = ({
  heading,
  level = 'h2',
  lead,
  action,
  children,
}: {
  heading: string;
  level?: 'h1' | 'h2';
  lead?: string;
  action?: ReactNode;
  children?: ReactNode;
}) => (
  <div>
    <div
      className={clx(
        'flex items-center justify-between gap-x-4 gap-y-3 px-6 py-4',
        lead && 'max-sm:flex-col max-sm:items-start',
      )}
    >
      <div className="flex flex-col gap-y-1">
        <Heading level={level}>{heading}</Heading>
        {lead && (
          <Text size="small" className="text-ui-fg-subtle">
            {lead}
          </Text>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children && <div className="px-6 pb-4">{children}</div>}
  </div>
);

export const ListEmpty = ({ hint }: { hint?: string }) => {
  const { t } = useTranslation('carlabAdmin');
  return (
    <div className="flex flex-col items-center gap-y-1 px-6 py-10 text-center">
      <Text size="small" weight="plus">
        {t('common.empty')}
      </Text>
      {hint && (
        <Text size="small" className="text-ui-fg-subtle">
          {hint}
        </Text>
      )}
    </div>
  );
};

export const RowActions = ({
  label,
  disabled,
  isLoading,
  onEdit,
  onDelete,
  deleteLabel,
}: {
  label: string;
  disabled?: boolean;
  isLoading?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}) => {
  const { t } = useTranslation('carlabAdmin');
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton
          size="small"
          variant="transparent"
          isLoading={isLoading}
          disabled={disabled}
          aria-label={label}
        >
          <EllipsisHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {onEdit && (
          <>
            <DropdownMenu.Item className="gap-x-2" onClick={onEdit}>
              <PencilSquare className="text-ui-fg-subtle" />
              {t('common.edit')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
          </>
        )}
        <DropdownMenu.Item
          className="text-ui-fg-error gap-x-2"
          onClick={onDelete}
        >
          <Trash />
          {deleteLabel ?? t('common.delete')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
