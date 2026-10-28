import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Buildings } from '@medusajs/icons';
import {
  Button,
  Checkbox,
  Container,
  Input,
  Label,
  Select,
  Switch,
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

import { Crawls } from '../../components/crawls';
import { EditedBy } from '../../components/edited-by';
import {
  ImportReports,
  importRunSchema,
  ImportRunReport,
} from '../../components/import-report';
import {
  LIST_TABLE,
  ListEmpty,
  ListHeader,
  ListLoading,
  PINNED_ACTIONS,
  RowActions,
} from '../../components/list';
import { ScrollArea } from '../../components/scroll-area';
import {
  acknowledged,
  adminFetch,
  editedBySchema,
  useWriting,
} from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { useConfirmed } from '../../lib/confirm';
import { type Category, categoriesSchema } from '../../lib/categories';

const supplierSchema = editedBySchema.extend({
  id: z.string(),
  name: z.string(),
  markup_percentage: z.number(),
  released_kinds: z.array(z.enum(STAGED_DATA_KINDS)),
  import_enabled: z.boolean(),
  offer_count: z.number(),
  latest_import: importRunSchema.nullable(),
});

type Supplier = z.infer<typeof supplierSchema>;

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
const sourcesSchema = z.object({ sources: z.array(sourceSchema) });
const offersWithdrawnSchema = z.object({ deleted: z.number() });
const importStartedSchema = z.object({ import_run: importRunSchema });
const sourceDeletedSchema = z.object({
  deleted: z.number(),
  import_disabled: z.boolean(),
});

const MANUAL_SOURCE = 'manual';

const MARKUP = /^\d+(?:\.\d{1,2})?$/;

const POLL_MS = 5000;

const SuppliersPage = () => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const prompt = usePrompt();
  const confirmed = useConfirmed();
  const writing = useWriting();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappedSupplierId, setMappedSupplierId] = useState('');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [removingSource, setRemovingSource] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const markLoaded = (list: string) =>
    setLoaded((current) => ({ ...current, [list]: true }));

  const load = async () => {
    const data = await adminFetch('/admin/suppliers', suppliersSchema);
    if (data) {
      setSuppliers(data.suppliers);
      markLoaded('suppliers');
    }
  };

  const loadMappings = async (supplierId: string) => {
    const data = await adminFetch(
      `/admin/suppliers/${supplierId}/categories`,
      mappingsSchema,
    );
    if (data) {
      setMappings(data.categories);
      markLoaded(`mappings-${supplierId}`);
    }
  };

  const loadSources = async () => {
    const data = await adminFetch('/admin/catalogue-sources', sourcesSchema);
    if (data) {
      setSources(data.sources);
      markLoaded('sources');
    }
  };

  const importRunning = suppliers.some(
    ({ latest_import }) => latest_import?.status === 'running',
  );

  useEffect(() => {
    if (!importRunning) return;
    const timer = setTimeout(() => {
      load();
      loadSources();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [suppliers]);

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
    const typed = (drafts[supplier.id] ?? '').trim().replace(',', '.');
    const markup_percentage = Number(typed);
    if (!MARKUP.test(typed) || markup_percentage > 500) {
      toast.error(t('suppliers.markupRequired'));
      return;
    }
    if (await update(supplier.id, { markup_percentage })) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[supplier.id];
        return next;
      });
      toast.success(
        t('suppliers.markupSaved', {
          supplier: sourceName(supplier.name),
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
          supplier: sourceName(supplier.name),
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
          supplier: sourceName(supplier.name),
        }),
      );
    }
  };

  const toggleImport = async (supplier: Supplier) => {
    const enabling = !supplier.import_enabled;
    const state = enabling ? 'on' : 'off';
    if (
      !(await prompt({
        variant: 'confirmation',
        title: t(`suppliers.importSwitch.${state}.title`, {
          supplier: sourceName(supplier.name),
        }),
        description: t(`suppliers.importSwitch.${state}.body`),
        confirmText: t(`suppliers.importSwitch.${state}.confirm`),
        cancelText: t('common.cancel'),
      }))
    ) {
      return;
    }
    if (await update(supplier.id, { import_enabled: enabling })) {
      toast.success(
        t(`suppliers.importSwitch.${state}.done`, {
          supplier: sourceName(supplier.name),
        }),
      );
    }
  };

  const importOne = async (supplier: Supplier) => {
    setImportingId(supplier.id);
    const data = await adminFetch(
      `/admin/suppliers/${supplier.id}/import`,
      importStartedSchema,
      { method: 'POST' },
    );
    if (data) {
      toast.success(
        t('suppliers.importStarted', { supplier: sourceName(supplier.name) }),
      );
      await load();
    }
    setImportingId(null);
  };

  const withdrawOffers = async (supplier: Supplier) => {
    let deleted = 0;
    const name = sourceName(supplier.name);
    const withdrawn = await confirmed({
      title: t('suppliers.withdraw.title', { supplier: name }),
      description: t('suppliers.withdraw.body', {
        count: supplier.offer_count,
      }),
      confirmText: t('suppliers.withdraw.action'),
      done: () =>
        t('suppliers.withdraw.done', { supplier: name, count: deleted }),
      run: async () => {
        const data = await adminFetch(
          `/admin/suppliers/${supplier.id}/offers`,
          offersWithdrawnSchema,
          { method: 'DELETE' },
        );
        deleted = data?.deleted ?? 0;
        return data;
      },
    });
    if (withdrawn) {
      await Promise.all([load(), loadSources()]);
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
    let importDisabled = false;
    const fromSupplier = suppliers.some(({ name }) => name === source);
    const removed = await confirmed({
      title: t('sources.confirmTitle', { source: sourceName(source) }),
      description: t(
        fromSupplier ? 'sources.confirmSupplierBody' : 'sources.confirmBody',
        { count: rows },
      ),
      confirmText: t('sources.remove'),
      done: () =>
        [
          t('sources.removed', { source: sourceName(source), count: deleted }),
          importDisabled && t('sources.importDisabled', { source }),
        ]
          .filter(Boolean)
          .join(' '),
      run: async () => {
        setRemovingSource(source);
        const data = await adminFetch(
          `/admin/catalogue-sources/${encodeURIComponent(source)}`,
          sourceDeletedSchema,
          { method: 'DELETE' },
        );
        deleted = data?.deleted ?? 0;
        importDisabled = data?.import_disabled ?? false;
        return data;
      },
    });
    setRemovingSource(null);
    if (removed) {
      await Promise.all([loadSources(), load()]);
    }
  };

  const sourceName = (source: string) =>
    t(`sources.names.${source}`, { defaultValue: source });

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="divide-y overflow-hidden p-0">
        <ListHeader
          heading={t('suppliers.heading')}
          level="h1"
          lead={t('suppliers.importLead')}
        />
        {!loaded.suppliers ? (
          <ListLoading />
        ) : suppliers.length ? (
          <ScrollArea pinnedEnd>
            <Table className={`${LIST_TABLE} ${PINNED_ACTIONS}`}>
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
                  <Table.HeaderCell>
                    {t('suppliers.columns.import')}
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {suppliers.map((supplier) => (
                  <Table.Row key={supplier.id}>
                    <Table.Cell>{sourceName(supplier.name)}</Table.Cell>
                    <Table.Cell>
                      <Input
                        type="number"
                        className="w-24"
                        min={0}
                        max={500}
                        step={0.01}
                        aria-label={t('suppliers.markupLabel', {
                          supplier: sourceName(supplier.name),
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
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter' &&
                            drafts[supplier.id] !== undefined &&
                            !writing
                          ) {
                            saveMarkup(supplier);
                          }
                        }}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="small"
                        variant="secondary"
                        isLoading={savingId === supplier.id}
                        disabled={drafts[supplier.id] === undefined || writing}
                        onClick={() => saveMarkup(supplier)}
                      >
                        {t('suppliers.save')}
                      </Button>
                    </Table.Cell>
                    <Table.Cell>
                      {supplier.name !== MANUAL_SOURCE && (
                        <div className="flex flex-col gap-y-1 py-2">
                          {STAGED_DATA_KINDS.map((kind) => (
                            <div
                              key={kind}
                              className="flex items-center gap-x-2"
                            >
                              <Checkbox
                                id={`${supplier.id}-${kind}`}
                                checked={supplier.released_kinds.includes(kind)}
                                disabled={writing}
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
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <EditedBy row={supplier} />
                    </Table.Cell>
                    <Table.Cell>
                      {supplier.name !== MANUAL_SOURCE && (
                        <div className="flex items-center justify-between gap-x-2">
                          <div className="flex flex-col gap-y-2 py-2">
                            <div className="flex items-center gap-x-2">
                              <Switch
                                id={`${supplier.id}-import`}
                                checked={supplier.import_enabled}
                                disabled={writing}
                                onCheckedChange={() => toggleImport(supplier)}
                              />
                              <Label
                                size="small"
                                htmlFor={`${supplier.id}-import`}
                                className="max-sm:sr-only"
                              >
                                {t(
                                  supplier.import_enabled
                                    ? 'suppliers.importOn'
                                    : 'suppliers.importOff',
                                )}
                              </Label>
                            </div>
                            {supplier.latest_import && (
                              <ImportRunReport run={supplier.latest_import} />
                            )}
                          </div>
                          <div className="flex items-center gap-x-2">
                            {supplier.import_enabled && (
                              <Button
                                size="small"
                                variant="secondary"
                                aria-label={t('suppliers.importOneLabel', {
                                  supplier: sourceName(supplier.name),
                                })}
                                isLoading={
                                  importingId === supplier.id ||
                                  supplier.latest_import?.status === 'running'
                                }
                                disabled={writing}
                                onClick={() => importOne(supplier)}
                              >
                                {t('suppliers.importOne')}
                              </Button>
                            )}
                            <RowActions
                              label={t('common.actionsFor', {
                                name: sourceName(supplier.name),
                              })}
                              disabled={writing}
                              deleteLabel={t('suppliers.withdraw.action')}
                              onDelete={() => withdrawOffers(supplier)}
                            />
                          </div>
                        </div>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </ScrollArea>
        ) : (
          <ListEmpty />
        )}
        <Text size="small" className="text-ui-fg-subtle px-6 py-4">
          {t('suppliers.releasedHint')}
        </Text>
      </Container>

      <ImportReports
        suppliers={suppliers.filter(({ name }) => name !== MANUAL_SOURCE)}
      />

      <Crawls />

      <Container className="divide-y overflow-hidden p-0">
        <ListHeader
          heading={t('suppliers.mappings.heading')}
          lead={t('suppliers.mappings.lead')}
        >
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
                    {sourceName(supplier.name)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </ListHeader>
        {mappedSupplierId && (
          <>
            {!loaded[`mappings-${mappedSupplierId}`] ? (
              <ListLoading />
            ) : mappings.length ? (
              <ScrollArea>
                <Table className={LIST_TABLE}>
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
                        <Table.Cell className="text-right">
                          <RowActions
                            label={t('common.actionsFor', {
                              name: mapping.code,
                            })}
                            disabled={writing}
                            onDelete={() => removeMapping(mapping)}
                          />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </ScrollArea>
            ) : (
              <ListEmpty hint={t('suppliers.mappings.empty')} />
            )}
            <div className="flex flex-wrap gap-2 px-6 py-4">
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
                disabled={!code.trim() || !categoryId || writing}
                onClick={addMapping}
              >
                {t('suppliers.mappings.add')}
              </Button>
            </div>
          </>
        )}
      </Container>

      <Container className="divide-y overflow-hidden p-0">
        <ListHeader heading={t('sources.heading')} lead={t('sources.lead')} />
        {!loaded.sources ? (
          <ListLoading />
        ) : sources.length ? (
          <ScrollArea>
            <Table className={LIST_TABLE}>
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
                      {entry.source !== MANUAL_SOURCE && (
                        <RowActions
                          label={t('sources.actionsFor', {
                            source: sourceName(entry.source),
                          })}
                          isLoading={removingSource === entry.source}
                          disabled={writing}
                          deleteLabel={t('sources.remove')}
                          onDelete={() => removeSource(entry)}
                        />
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </ScrollArea>
        ) : (
          <ListEmpty hint={t('sources.empty')} />
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
