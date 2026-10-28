import { PencilSquare } from '@medusajs/icons';
import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  toast,
} from '@medusajs/ui';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { acknowledged, adminFetch, useWriting } from '../lib/admin-fetch';
import { DrawerHeader } from './dialog-header';

export const SlugRename = ({
  kind,
  id,
  slug,
  name,
  reload,
}: {
  kind: 'brand' | 'make' | 'model' | 'category';
  id: string;
  slug: string;
  name: string;
  reload: () => Promise<unknown>;
}) => {
  const { t } = useTranslation('carlabAdmin');
  const writing = useWriting();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(slug);
  const [saving, setSaving] = useState(false);
  const inputId = `slug-${id}`;

  useEffect(() => {
    if (open) setDraft(slug);
  }, [open, slug]);

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    const next = draft.trim();
    setSaving(true);
    const renamed = await adminFetch('/admin/catalogue-slugs', acknowledged, {
      method: 'POST',
      body: JSON.stringify({ kind, id, slug: next }),
    });
    setSaving(false);
    if (renamed) {
      toast.success(t('slugRename.renamed', { slug: next }));
      setOpen(false);
      await reload();
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button
          size="small"
          variant="transparent"
          disabled={writing}
          aria-label={t('slugRename.open', { name })}
          className="txt-compact-small max-w-full justify-start whitespace-normal break-all text-left font-normal"
        >
          {slug}
          <PencilSquare className="text-ui-fg-muted shrink-0" />
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <form
          onSubmit={rename}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DrawerHeader>
            <Drawer.Title asChild>
              <Heading>{t('slugRename.title', { name })}</Heading>
            </Drawer.Title>
            <Drawer.Description className="txt-small text-ui-fg-subtle">
              {t('slugRename.description')}
            </Drawer.Description>
          </DrawerHeader>
          <Drawer.Body className="flex flex-col gap-y-2 overflow-y-auto">
            <Label size="small" weight="plus" htmlFor={inputId}>
              {t('slugRename.label')}
            </Label>
            <Input
              id={inputId}
              value={draft}
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {t('slugRename.hint')}
            </Text>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button size="small" variant="secondary" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </Drawer.Close>
            <Button
              size="small"
              type="submit"
              isLoading={saving}
              disabled={writing || !draft.trim() || draft.trim() === slug}
            >
              {t('slugRename.save')}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  );
};
