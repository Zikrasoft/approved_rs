import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Buildings, EllipsisHorizontal, Trash } from '@medusajs/icons';
import {
  Button,
  Checkbox,
  Container,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
  usePrompt,
} from '@medusajs/ui';
import {
  STAGED_DATA_KINDS,
  type StagedDataKind,
} from '@podbor/catalog-contract';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import {
  acknowledged,
  adminFetch,
  editedBySchema,
} from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { useConfirmed } from '../../lib/confirm';

const supplierSchema = editedBySchema.extend({
  id: z.string(),
  name: z.string(),
  markup_percentage: z.number(),
  released_kinds: z.array(z.enum(STAGED_DATA_KINDS)),
});

type Supplier = z.infer<typeof supplierSchema>;

const categorySchema = z.object({ id: z.string(), name: z.string() });

type Category = z.infer<typeof categorySchema>;

const mappingSchema = editedBySchema.extend({
  id: z.string(),
  code: z.string(),
  category_id: z.string(),
});

type Mapping = z.infer<typeof mappingSchema>;

const sourceSchema = z.object({ source: z.string(), rows: z.number() });

type Source = z.infer<typeof sourceSchema>;

const suppliersSchema = z.object({ suppliers: z.array(supplierSchema) });
const mappingsSchema = z.object({ categories: z.array(mappingSchema) });
const categoriesSchema = z.object({ categories: z.array(categorySchema) });
const sourcesSchema = z.object({ sources: z.array(sourceSchema) });
const importsSchema = z.object({
  imports: z.array(
    z.object({
      supplier: z.string(),
      imported: z.number(),
      created: z.number(),
      skipped: z.number(),
      skipped_by_reason: z.object({
        category: z.number(),
        brand: z.number(),
        currency: z.number(),
      }),
    }),
  ),
});
const sourceDeletedSchema = z.object({ deleted: z.number() });

const SuppliersPage = () => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const prompt = usePrompt();
  const confirmed = useConfirmed();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappedSupplierId, setMappedSupplierId] = useState('');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [removingSource, setRemovingSource] = useState<string | null>(null);

  const load = async () => {
    const data = await adminFetch('/admin/suppliers', suppliersSchema);
    if (data) {
      setSuppliers(data.suppliers);
    }
  };

  const loadMappings = async (supplierId: string) => {
    const data = await adminFetch(
      `/admin/suppliers/${supplierId}/categories`,
      mappingsSchema,
    );
    if (data) {
      setMappings(data.categories);
    }
  };

  const loadSources = async () => {
    const data = await adminFetch('/admin/catalogue-sources', sourcesSchema);
    if (data) {
      setSources(data.sources);
    }
  };

  useEffect(() => {
    load();
    loadSources();
    adminFetch('/admin/categories', categoriesSchema).then((data) => {
      if (data) {
        setCategories(data.categories);
      }
    });
  }, []);

  const update = async (id: string, body: Partial<Supplier>) => {
    setSavingId(id);
    const saved = await adminFetch(`/admin/suppliers/${id}`, acknowledged, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setSavingId(null);
    await load();
    return saved;
  };

  const saveMarkup = async (supplier: Supplier) => {
    const markup_percentage = Number(
      (drafts[supplier.id] ?? '').replace(',', '.'),
    );
    if (await update(supplier.id, { markup_percentage })) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[supplier.id];
        return next;
      });
      toast.success(
        t('suppliers.markupSaved', {
          supplier: supplier.name,
          markup: markup_percentage.toLocaleString(i18n.language),
        }),
      );
    }
  };

  const toggleRelease = async (supplier: Supplier, kind: StagedDataKind) => {
    const releasing = !supplier.released_kinds.includes(kind);
    const kindName = t(`suppliers.kinds.${kind}`);
    if (
      releasing &&
      !(await prompt({
        variant: 'confirmation',
        title: t('suppliers.confirmReleaseTitle', {
          kind: kindName,
          supplier: supplier.name,
        }),
        description: t('suppliers.confirmReleaseBody'),
        confirmText: t('suppliers.confirmRelease'),
        cancelText: t('common.cancel'),
      }))
    ) {
      return;
    }
    const saved = await update(supplier.id, {
      released_kinds: releasing
        ? [...supplier.released_kinds, kind]
        : supplier.released_kinds.filter((released) => released !== kind),
    });
    if (saved) {
      toast.success(
        t(releasing ? 'suppliers.released' : 'suppliers.hidden', {
          kind: kindName,
          supplier: supplier.name,
        }),
      );
    }
  };

  const importLine = (
    summary: z.infer<typeof importsSchema>['imports'][number],
  ) =>
    [
      t('suppliers.importSummary', summary),
      summary.skipped || summary.skipped_by_reason.currency
        ? t('suppliers.importSkipped', summary.skipped_by_reason)
        : null,
    ]
      .filter(Boolean)
      .join(' ');

  const runImport = async () => {
    setImporting(true);
    const data = await adminFetch('/admin/supplier-imports', importsSchema, {
      method: 'POST',
    });
    setImporting(false);
    if (data) {
      toast.success(
        data.imports.length
          ? data.imports.map(importLine).join('\n')
          : t('suppliers.importNoAdapters'),
      );
    }
  };

  const chooseSupplier = (supplierId: string) => {
    setMappedSupplierId(supplierId);
    loadMappings(supplierId);
  };

  const addMapping = async () => {
    const created = await adminFetch(
      `/admin/suppliers/${mappedSupplierId}/categories`,
      acknowledged,
      {
        method: 'POST',
        body: JSON.stringify({ code, category_id: categoryId }),
      },
    );
    if (created) {
      toast.success(
        t('suppliers.mappings.added', {
          code: code.trim(),
          category: categoryName(categoryId),
        }),
      );
      setCode('');
      setCategoryId('');
      await loadMappings(mappedSupplierId);
    }
  };

  const removeMapping = async (mapping: Mapping) => {
    if (
      await confirmed({
        title: t('suppliers.mappings.confirmRemoveTitle', {
          code: mapping.code,
        }),
        description: t('suppliers.mappings.confirmRemoveBody'),
        done: t('suppliers.mappings.removed', { code: mapping.code }),
        run: () =>
          adminFetch(
            `/admin/suppliers/${mappedSupplierId}/categories/${mapping.id}`,
            acknowledged,
            { method: 'DELETE' },
          ),
      })
    ) {
      await loadMappings(mappedSupplierId);
    }
  };

  const removeSource = async ({ source, rows }: Source) => {
    let deleted = 0;
    const removed = await confirmed({
      title: t('sources.confirmTitle', { source: sourceName(source) }),
      description: t('sources.confirmBody', { count: rows }),
      confirmText: t('sources.remove'),
      done: () =>
        t('sources.removed', { source: sourceName(source), count: deleted }),
      run: async () => {
        setRemovingSource(source);
        const data = await adminFetch(
          `/admin/catalogue-sources/${encodeURIComponent(source)}`,
          sourceDeletedSchema,
          { method: 'DELETE' },
        );
        deleted = data?.deleted ?? 0;
        return data;
      },
    });
    setRemovingSource(null);
    if (removed) {
      await loadSources();
    }
  };

  const sourceName = (source: string) =>
    t(`sources.names.${source}`, { defaultValue: source });

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex flex-col gap-y-4">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="flex flex-col gap-y-1">
            <Heading level="h1">{t('suppliers.heading')}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {t('suppliers.importLead')}
            </Text>
          </div>
          <Button variant="secondary" isLoading={importing} onClick={runImport}>
            {t('suppliers.import')}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>
                  {t('suppliers.columns.name')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('suppliers.columns.markup')}
                </Table.HeaderCell>
                <Table.HeaderCell />
                <Table.HeaderCell>
                  {t('suppliers.columns.released')}
                </Table.HeaderCell>
                <Table.HeaderCell>{t('edited.column')}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {suppliers.map((supplier) => (
                <Table.Row key={supplier.id}>
                  <Table.Cell>{supplier.name}</Table.Cell>
                  <Table.Cell>
                    <Input
                      type="number"
                      className="w-24"
                      min={0}
                      max={500}
                      step={0.01}
                      aria-label={t('suppliers.markupLabel', {
                        supplier: supplier.name,
                      })}
                      value={
                        drafts[supplier.id] ??
                        String(supplier.markup_percentage)
                      }
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [supplier.id]: event.target.value,
                        }))
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="small"
                      variant="secondary"
                      isLoading={savingId === supplier.id}
                      disabled={drafts[supplier.id] === undefined}
                      onClick={() => saveMarkup(supplier)}
                    >
                      {t('suppliers.save')}
                    </Button>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col gap-y-1 py-2">
                      {STAGED_DATA_KINDS.map((kind) => (
                        <div key={kind} className="flex items-center gap-x-2">
                          <Checkbox
                            id={`${supplier.id}-${kind}`}
                            checked={supplier.released_kinds.includes(kind)}
                            disabled={savingId === supplier.id}
                            onCheckedChange={() =>
                              toggleRelease(supplier, kind)
                            }
                          />
                          <Label
                            size="small"
                            htmlFor={`${supplier.id}-${kind}`}
                          >
                            {t(`suppliers.kinds.${kind}`)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <EditedBy row={supplier} />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('suppliers.releasedHint')}
        </Text>
      </Container>

      <Container className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h2">{t('suppliers.mappings.heading')}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {t('suppliers.mappings.lead')}
          </Text>
        </div>
        <div className="max-w-xs">
          <Select value={mappedSupplierId} onValueChange={chooseSupplier}>
            <Select.Trigger>
              <Select.Value
                placeholder={t('suppliers.mappings.supplierPlaceholder')}
              />
            </Select.Trigger>
            <Select.Content>
              {suppliers.map((supplier) => (
                <Select.Item key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        {mappedSupplierId && (
          <>
            {mappings.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>
                        {t('suppliers.mappings.code')}
                      </Table.HeaderCell>
                      <Table.HeaderCell>
                        {t('suppliers.mappings.category')}
                      </Table.HeaderCell>
                      <Table.HeaderCell>{t('edited.column')}</Table.HeaderCell>
                      <Table.HeaderCell />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {mappings.map((mapping) => (
                      <Table.Row key={mapping.id}>
                        <Table.Cell>{mapping.code}</Table.Cell>
                        <Table.Cell>
                          {categoryName(mapping.category_id)}
                        </Table.Cell>
                        <Table.Cell>
                          <EditedBy row={mapping} />
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => removeMapping(mapping)}
                          >
                            {t('suppliers.mappings.remove')}
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            ) : (
              <Text size="small">{t('suppliers.mappings.empty')}</Text>
            )}
            <div className="flex flex-wrap gap-2">
              <Input
                size="small"
                className="max-w-xs"
                placeholder={t('suppliers.mappings.codePlaceholder')}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <div className="w-64">
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <Select.Trigger>
                    <Select.Value
                      placeholder={t('suppliers.mappings.categoryPlaceholder')}
                    />
                  </Select.Trigger>
                  <Select.Content>
                    {categories.map((category) => (
                      <Select.Item key={category.id} value={category.id}>
                        {category.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <Button
                size="small"
                disabled={!code.trim() || !categoryId}
                onClick={addMapping}
              >
                {t('suppliers.mappings.add')}
              </Button>
            </div>
          </>
        )}
      </Container>

      <Container className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h2">{t('sources.heading')}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {t('sources.lead')}
          </Text>
        </div>
        {sources.length ? (
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>{t('sources.source')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('sources.rows')}</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">
                    {t('common.actions')}
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sources.map((entry) => (
                  <Table.Row key={entry.source}>
                    <Table.Cell>{sourceName(entry.source)}</Table.Cell>
                    <Table.Cell>
                      {entry.rows.toLocaleString(i18n.language)}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton
                            size="small"
                            variant="transparent"
                            isLoading={removingSource === entry.source}
                            aria-label={t('sources.actionsFor', {
                              source: sourceName(entry.source),
                            })}
                          >
                            <EllipsisHorizontal />
                          </IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end">
                          <DropdownMenu.Item
                            className="text-ui-fg-error gap-x-2"
                            onClick={() => removeSource(entry)}
                          >
                            <Trash />
                            {t('sources.remove')}
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        ) : (
          <Text size="small">{t('sources.empty')}</Text>
        )}
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'menu.suppliers',
  icon: Buildings,
  rank: 9,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.suppliers');

export default SuppliersPage;
