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

import {
  adminFetch,
  editedBySchema,
  type EditedBy as Edited,
  useWriting,
} from '../lib/admin-fetch';
import { DrawerHeader } from './dialog-header';
import { EditedBy } from './edited-by';

type Locale = (typeof CATALOG_TRANSLATION_LOCALES)[number];
type Drafts = Partial<Record<Locale, Record<string, string>>>;

const translationsSchema = z.object({
  translations: z.partialRecord(
    z.enum(CATALOG_TRANSLATION_LOCALES),
    z.record(z.string(), z.string()),
  ),
  edited: editedBySchema.optional(),
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
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [stored, setStored] = useState<Drafts>({});
  const [edited, setEdited] = useState<Edited | null>(null);
  const [saving, setSaving] = useState(false);
  const path = `/admin/translations/${entity}/${id}`;

  const load = async () => {
    const data = await adminFetch(path, translationsSchema);
    setDrafts(data?.translations ?? {});
    setStored(data?.translations ?? {});
    setEdited(data?.edited ?? null);
  };

  const change = (locale: Locale, field: string, value: string) =>
    setDrafts((current) => ({
      ...current,
      [locale]: { ...current[locale], [field]: value },
    }));

  const save = async () => {
    const changes = CATALOG_TRANSLATION_LOCALES.map(
      (locale) =>
        [
          locale,
          Object.fromEntries(
            Object.entries(drafts[locale] ?? {}).filter(
              ([field, value]) =>
                value.trim() && value !== stored[locale]?.[field],
            ),
          ),
        ] as const,
    ).filter(([, fields]) => Object.keys(fields).length > 0);
    if (changes.length === 0) {
      toast.info(t('translations.nothingChanged'));
      setOpen(false);
      return;
    }
    setSaving(true);
    let saved = true;
    for (const [locale, fields] of changes) {
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
        <Button disabled={writing} size="small" variant="secondary">
          {t('translations.open')}
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <DrawerHeader>
          <Drawer.Title asChild>
            <Heading>{t('translations.heading')}</Heading>
          </Drawer.Title>
          <Drawer.Description className="txt-small text-ui-fg-subtle">
            {t('translations.lead')}
          </Drawer.Description>
        </DrawerHeader>
        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          {edited && <EditedBy row={edited} />}
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
                    rows={field === 'text' || field === 'description' ? 6 : 2}
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
            <Button disabled={writing} variant="secondary">
              {t('translations.cancel')}
            </Button>
          </Drawer.Close>
          <Button disabled={writing} isLoading={saving} onClick={save}>
            {t('translations.save')}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
