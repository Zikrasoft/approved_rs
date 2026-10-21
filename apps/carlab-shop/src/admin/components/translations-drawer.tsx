import {
  Button,
  Drawer,
  Heading,
  Label,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { CATALOG_TRANSLATION_LOCALES } from '@podbor/catalog-contract';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { adminFetch } from '../lib/admin-fetch';

type Locale = (typeof CATALOG_TRANSLATION_LOCALES)[number];
type Drafts = Partial<Record<Locale, Record<string, string>>>;

const translationsSchema = z.object({
  translations: z.partialRecord(
    z.enum(CATALOG_TRANSLATION_LOCALES),
    z.record(z.string(), z.string()),
  ),
});

export const TranslationsDrawer = ({
  entity,
  id,
  source,
}: {
  entity: string;
  id: string;
  source: Record<string, string>;
}) => {
  const { t } = useTranslation('carlabAdmin');
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saving, setSaving] = useState(false);
  const path = `/admin/translations/${entity}/${id}`;

  const load = async () => {
    const data = await adminFetch(path, translationsSchema);
    setDrafts(data?.translations ?? {});
  };

  const change = (locale: Locale, field: string, value: string) =>
    setDrafts((current) => ({
      ...current,
      [locale]: { ...current[locale], [field]: value },
    }));

  const save = async () => {
    setSaving(true);
    let saved = true;
    for (const locale of CATALOG_TRANSLATION_LOCALES) {
      const fields = Object.fromEntries(
        Object.entries(drafts[locale] ?? {}).filter(([, value]) =>
          value.trim(),
        ),
      );
      if (Object.keys(fields).length === 0) continue;
      saved =
        Boolean(
          await adminFetch(path, translationsSchema, {
            method: 'POST',
            body: JSON.stringify({ locale, fields }),
          }),
        ) && saved;
    }
    setSaving(false);
    if (saved) {
      toast.success(t('translations.saved'));
      setOpen(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <Drawer.Trigger asChild>
        <Button size="small" variant="secondary">
          {t('translations.open')}
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{t('translations.heading')}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          <Text size="small" className="text-ui-fg-subtle">
            {t('translations.lead')}
          </Text>
          {Object.entries(source).map(([field, russian]) => (
            <div key={field} className="flex flex-col gap-y-3">
              <div className="flex flex-col gap-y-1">
                <Heading level="h3">
                  {t(`translations.fields.${field}`)}
                </Heading>
                <Text
                  size="small"
                  className="whitespace-pre-line text-ui-fg-subtle"
                >
                  {russian}
                </Text>
              </div>
              {CATALOG_TRANSLATION_LOCALES.map((locale) => (
                <div key={locale} className="flex flex-col gap-y-1">
                  <Label size="xsmall" htmlFor={`${id}-${field}-${locale}`}>
                    {t(`translations.locales.${locale}`)}
                  </Label>
                  <Textarea
                    id={`${id}-${field}-${locale}`}
                    rows={field === 'text' ? 6 : 2}
                    value={drafts[locale]?.[field] ?? ''}
                    onChange={(event) =>
                      change(locale, field, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          ))}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">{t('translations.cancel')}</Button>
          </Drawer.Close>
          <Button isLoading={saving} onClick={save}>
            {t('translations.save')}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
