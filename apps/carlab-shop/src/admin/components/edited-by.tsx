import { Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';

import type { EditedBy as Edited } from '../lib/admin-fetch';

export const EditedBy = ({ row }: { row: Edited }) => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const editor = row.updated_by_user;
  return (
    <Text size="xsmall" className="text-ui-fg-subtle whitespace-nowrap">
      {t('edited.line', {
        when: new Date(row.updated_at).toLocaleString(i18n.language),
        who: editor ? (editor.name ?? editor.email) : t('edited.nobody'),
      })}
    </Text>
  );
};
