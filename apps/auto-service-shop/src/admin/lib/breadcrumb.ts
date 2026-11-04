import { getI18n } from 'react-i18next';

export const breadcrumb = (key: string) => ({
  breadcrumb: () => getI18n().t(key, { ns: 'carlabAdmin' }),
});
