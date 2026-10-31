import { defineRouteConfig } from '@medusajs/admin-sdk';
import { TruckFast } from '@medusajs/icons';
import {
  Button,
  Container,
  Drawer,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Tabs,
  Text,
  toast,
} from '@medusajs/ui';
import {
  BODY_STYLES,
  ENGINE_FUELS,
  STEERING_SIDES,
  VEHICLE_DRIVES,
  MANUFACTURER_VEHICLE_IDENTIFIER_TYPES,
} from '@podbor/catalog-contract';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { slugOf } from '../../../lib/slug';
import { EditedBy } from '../../components/edited-by';
import {
  LIST_TABLE,
  ListEmpty,
  ListHeader,
  ListLoading,
  PINNED_ACTIONS,
  RowActions,
} from '../../components/list';
import { DrawerHeader, ModalHeader } from '../../components/dialog-header';
import {
  listingSchema,
  ReferencePicker,
} from '../../components/reference-picker';
import { ScrollArea } from '../../components/scroll-area';
import { SlugRename } from '../../components/slug-rename';
import {
  Spellings,
  spellingSchema,
  type Supplier,
  suppliersSchema,
} from '../../components/spellings';
import { TranslationsDrawer } from '../../components/translations-drawer';
import {
  acknowledged,
  adminFetch,
  editedBySchema,
  useWriting,
} from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { useConfirmed } from '../../lib/confirm';
import {
  labelledVehicleSchema,
  referenceLabel,
  type ReferenceRow,
  type TFunction,
  vehicleSpecLabel,
} from '../../lib/vehicle-label';

const PAGE_SIZE = 50;

const targetSchema = z.object({ id: z.string() }).loose();

const rowSchema = editedBySchema.extend({ id: z.string() }).loose();

type Row = z.infer<typeof rowSchema>;
type Listing = { rows: Row[]; count: number };

type Field =
  | { key: string; kind: 'text' | 'number' }
  | { key: string; kind: 'enum'; values: readonly string[] }
  | { key: string; kind: 'ref'; collection: string; ownName?: boolean };

type Column = { key: string; read: (row: Row) => string | undefined };

type Entity = {
  collection: string;
  path: string;
  object: string;
  fields: Field[];
  columns?: Column[];
  translatable?: string;
  spellings?: boolean;
};

const spelledRowSchema = z.object({ spellings: z.array(spellingSchema) });

const vehicleChassis = (row: Row) => {
  const vehicle = labelledVehicleSchema.safeParse(row);
  return vehicle.success ? vehicle.data.model.chassis : undefined;
};

const ENTITIES: Entity[] = [
  {
    collection: 'vehicles',
    path: 'vehicles',
    object: 'vehicle',
    columns: [
      {
        key: 'make_id',
        read: (row) => vehicleChassis(row)?.series?.make?.name,
      },
      { key: 'chassis_id', read: (row) => vehicleChassis(row)?.code },
    ],
    fields: [
      {
        key: 'model_id',
        kind: 'ref',
        collection: 'vehicle_models',
        ownName: true,
      },
      { key: 'engine_id', kind: 'ref', collection: 'engines' },
      { key: 'power_kw', kind: 'number' },
      { key: 'drive', kind: 'enum', values: VEHICLE_DRIVES },
      { key: 'market', kind: 'text' },
      { key: 'year_from', kind: 'number' },
      { key: 'year_to', kind: 'number' },
      { key: 'steering', kind: 'enum', values: STEERING_SIDES },
    ],
  },
  {
    collection: 'makes',
    path: 'makes',
    object: 'make',
    spellings: true,
    fields: [
      { key: 'name', kind: 'text' },
      { key: 'slug', kind: 'text' },
    ],
  },
  {
    collection: 'series',
    path: 'series',
    object: 'series',
    translatable: 'series',
    fields: [
      { key: 'make_id', kind: 'ref', collection: 'makes' },
      { key: 'name', kind: 'text' },
    ],
  },
  {
    collection: 'chassis',
    path: 'chassis',
    object: 'chassis',
    fields: [
      { key: 'series_id', kind: 'ref', collection: 'series' },
      { key: 'code', kind: 'text' },
      { key: 'body_style', kind: 'enum', values: BODY_STYLES },
      { key: 'year_from', kind: 'number' },
      { key: 'year_to', kind: 'number' },
    ],
  },
  {
    collection: 'vehicle_models',
    path: 'vehicle-models',
    object: 'vehicle_model',
    fields: [
      { key: 'chassis_id', kind: 'ref', collection: 'chassis' },
      { key: 'name', kind: 'text' },
      { key: 'slug', kind: 'text' },
    ],
  },
  {
    collection: 'engines',
    path: 'engines',
    object: 'engine',
    fields: [
      { key: 'code', kind: 'text' },
      { key: 'family', kind: 'text' },
      { key: 'fuel', kind: 'enum', values: ENGINE_FUELS },
      { key: 'displacement_cc', kind: 'number' },
    ],
  },
  {
    collection: 'vehicle_identifiers',
    path: 'vehicle-identifiers',
    object: 'vehicle_identifier',
    fields: [
      { key: 'vehicle_id', kind: 'ref', collection: 'vehicles' },
      {
        key: 'type',
        kind: 'enum',
        values: MANUFACTURER_VEHICLE_IDENTIFIER_TYPES,
      },
      { key: 'value', kind: 'text' },
    ],
  },
];

const WIDE_FORM_FIELDS = 6;

const PATHS = Object.fromEntries(
  ENTITIES.map(({ collection, path }) => [collection, path]),
);

const relationOf = (field: Field) => field.key.replace(/_id$/, '');

const SLUG_KINDS: Record<string, 'make' | 'model'> = {
  make: 'make',
  vehicle_model: 'model',
};

const formFields = (entity: Entity, row: Row | null) =>
  row ? entity.fields.filter(({ key }) => key !== 'slug') : entity.fields;

const rowLabel = (
  t: TFunction,
  collection: string,
  row: ReferenceRow,
): string => {
  const vehicle = labelledVehicleSchema.safeParse(row);
  if (collection === 'vehicles' && vehicle.success) {
    return vehicleSpecLabel(t, vehicle.data);
  }
  return referenceLabel(collection, row);
};

const refLabel = (t: TFunction, field: Field, row: Row): string => {
  const target = targetSchema.safeParse(row[relationOf(field)]);
  if (field.kind !== 'ref' || !target.success) return '';
  if (field.ownName && target.data.name != null) {
    return String(target.data.name);
  }
  return rowLabel(t, field.collection, target.data);
};

const toBody = (fields: Field[], draft: Record<string, string>) =>
  Object.fromEntries(
    fields
      .filter(({ key }) => draft[key] !== undefined)
      .map(({ key, kind }) => {
        const value = draft[key].trim();
        if (!value) return [key, null];
        return [key, kind === 'number' ? Number(value) : value];
      }),
  );

const fromRow = (fields: Field[], row: Row): Record<string, string> =>
  Object.fromEntries(
    fields.map(({ key }) => [key, row[key] == null ? '' : String(row[key])]),
  );

const enumLabel = (t: TFunction, field: Field, value: unknown) =>
  t(`vehicles.values.${field.key}.${String(value)}`);

const EntityTable = ({
  entity,
  list,
  suppliers,
  reload,
  onEdit,
  onMerge,
}: {
  entity: Entity;
  list: Row[] | null;
  suppliers: Supplier[];
  reload: () => Promise<void>;
  onEdit: (row: Row) => void;
  onMerge: (row: Row) => void;
}) => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();

  const cell = (field: Field, row: Row): string => {
    const value = row[field.key];
    if (value == null || value === '') return '-';
    if (field.kind === 'text' || field.kind === 'number') return String(value);
    if (field.kind === 'enum') return enumLabel(t, field, value);
    return refLabel(t, field, row) || String(value);
  };

  const remove = async (row: Row) => {
    const name = rowLabel(t, entity.collection, row);
    if (
      await confirmed({
        title: t('vehicles.confirmTitle', { name }),
        description: t('vehicles.confirmDelete'),
        done: t('vehicles.deleted', { name }),
        run: () =>
          adminFetch(`/admin/${entity.path}/${row.id}`, acknowledged, {
            method: 'DELETE',
          }),
      })
    ) {
      await reload();
    }
  };

  if (!list) return <ListLoading />;
  if (!list.length) return <ListEmpty hint={t('vehicles.emptyHint')} />;

  return (
    <ScrollArea pinnedEnd>
      <Table className={`${LIST_TABLE} ${PINNED_ACTIONS}`}>
        <Table.Header>
          <Table.Row>
            {entity.columns?.map((column) => (
              <Table.HeaderCell key={column.key}>
                {t(`vehicles.fields.${column.key}`)}
              </Table.HeaderCell>
            ))}
            {entity.fields.map((field) => (
              <Table.HeaderCell key={field.key}>
                {t(`vehicles.fields.${field.key}`)}
              </Table.HeaderCell>
            ))}
            {entity.spellings && (
              <Table.HeaderCell>
                {t('vehicles.makeSpellings.column')}
              </Table.HeaderCell>
            )}
            <Table.HeaderCell>{t('edited.column')}</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {list.map((row) => (
            <Table.Row key={row.id}>
              {entity.columns?.map((column) => (
                <Table.Cell key={column.key}>
                  {column.read(row) ?? '-'}
                </Table.Cell>
              ))}
              {entity.fields.map((field) => (
                <Table.Cell
                  key={field.key}
                  className="max-w-[14rem] whitespace-normal break-words"
                >
                  {field.key === 'slug' && SLUG_KINDS[entity.object] ? (
                    <SlugRename
                      kind={SLUG_KINDS[entity.object]}
                      id={row.id}
                      slug={String(row.slug)}
                      name={rowLabel(t, entity.collection, row)}
                      reload={reload}
                    />
                  ) : (
                    cell(field, row)
                  )}
                </Table.Cell>
              ))}
              {entity.spellings && (
                <Table.Cell>
                  <Spellings
                    path={`/admin/${entity.path}/${row.id}/spellings`}
                    copy="vehicles.makeSpellings"
                    spellings={spelledRowSchema.parse(row).spellings}
                    suppliers={suppliers}
                    reload={reload}
                  />
                </Table.Cell>
              )}
              <Table.Cell>
                <EditedBy row={row} />
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center justify-end gap-x-2">
                  {entity.translatable && (
                    <TranslationsDrawer
                      entity={entity.translatable}
                      id={row.id}
                      source={{ name: String(row.name ?? '') }}
                    />
                  )}
                  <RowActions
                    label={t('common.actionsFor', {
                      name: rowLabel(t, entity.collection, row),
                    })}
                    disabled={writing}
                    onEdit={() => onEdit(row)}
                    {...(entity.object === 'make' && {
                      onMerge: () => onMerge(row),
                      mergeLabel: t('vehicles.merge.action'),
                    })}
                    onDelete={() => remove(row)}
                  />
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </ScrollArea>
  );
};

const EntityForm = ({
  entity,
  row,
  open,
  onOpenChange,
  reload,
}: {
  entity: Entity;
  row: Row | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reload: () => Promise<void>;
}) => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const shown = formFields(entity, row);
  const wide = shown.length >= WIDE_FORM_FIELDS;

  useEffect(() => {
    if (!open) return;
    setDraft(row ? fromRow(formFields(entity, row), row) : {});
    setPicked(
      row
        ? Object.fromEntries(
            entity.fields.map((field) => [field.key, refLabel(t, field, row)]),
          )
        : {},
    );
  }, [open, row, entity]);

  const hasSlug = shown.some(({ key }) => key === 'slug');

  const setText = (key: string, value: string) =>
    setDraft((current) => {
      const followsName =
        !row &&
        hasSlug &&
        key === 'name' &&
        (current.slug ?? '') === slugOf(current.name ?? '');
      return {
        ...current,
        [key]: value,
        ...(followsName && { slug: slugOf(value) }),
      };
    });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const saved = await adminFetch(
      row ? `/admin/${entity.path}/${row.id}` : `/admin/${entity.path}`,
      acknowledged,
      { method: 'POST', body: JSON.stringify(toBody(shown, draft)) },
    );
    setSaving(false);
    if (saved) {
      toast.success(t('common.saved'));
      onOpenChange(false);
      await reload();
    }
  };

  const title = t(row ? 'vehicles.editTitle' : 'vehicles.newTitle');
  const section = t(`vehicles.entities.${entity.object}`);

  const fields = (
    <div
      className={
        wide ? 'grid grid-cols-1 gap-4 sm:grid-cols-2' : 'flex flex-col gap-y-4'
      }
    >
      {shown.map((field) => {
        const id = `${entity.path}-${field.key}`;
        return (
          <div key={field.key} className="flex flex-col gap-y-2">
            <Label size="small" weight="plus" htmlFor={id}>
              {t(`vehicles.fields.${field.key}`)}
            </Label>
            {field.kind === 'text' || field.kind === 'number' ? (
              <Input
                id={id}
                type={field.kind}
                maxLength={200}
                value={draft[field.key] ?? ''}
                onChange={(event) => setText(field.key, event.target.value)}
              />
            ) : field.kind === 'ref' ? (
              <ReferencePicker
                id={id}
                path={PATHS[field.collection]}
                collection={field.collection}
                label={picked[field.key] ?? ''}
                optionLabel={(option) => rowLabel(t, field.collection, option)}
                onChange={(value, label) => {
                  setDraft((current) => ({ ...current, [field.key]: value }));
                  setPicked((current) => ({ ...current, [field.key]: label }));
                }}
              />
            ) : (
              <Select
                value={draft[field.key] ?? ''}
                onValueChange={(value) =>
                  setDraft({ ...draft, [field.key]: value })
                }
              >
                <Select.Trigger id={id}>
                  <Select.Value placeholder={t('vehicles.choose')} />
                </Select.Trigger>
                <Select.Content>
                  {(field.kind === 'enum' ? field.values : []).map((value) => (
                    <Select.Item key={value} value={value}>
                      {enumLabel(t, field, value)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            )}
          </div>
        );
      })}
      {entity.object === 'vehicle_identifier' && (
        <Text size="small" className="text-ui-fg-subtle">
          {t('vehicles.identifierFormat')}
        </Text>
      )}
    </div>
  );

  const actions = (close: typeof Drawer.Close) => {
    const Close = close;
    return (
      <>
        <Close asChild>
          <Button size="small" variant="secondary" disabled={saving}>
            {t('vehicles.cancel')}
          </Button>
        </Close>
        <Button
          size="small"
          type="submit"
          isLoading={saving}
          disabled={writing}
        >
          {row ? t('vehicles.save') : t('vehicles.create')}
        </Button>
      </>
    );
  };

  if (wide) {
    return (
      <FocusModal open={open} onOpenChange={onOpenChange}>
        <FocusModal.Content>
          <form
            onSubmit={save}
            className="flex h-full flex-col overflow-hidden"
          >
            <ModalHeader />
            <FocusModal.Body className="flex flex-col items-center overflow-y-auto px-4 py-10 sm:py-16">
              <div className="flex w-full max-w-[720px] flex-col gap-y-8">
                <div className="flex flex-col gap-y-1">
                  <FocusModal.Title asChild>
                    <Heading>{title}</Heading>
                  </FocusModal.Title>
                  <FocusModal.Description asChild>
                    <Text size="small" className="text-ui-fg-subtle">
                      {section}
                    </Text>
                  </FocusModal.Description>
                </div>
                {fields}
              </div>
            </FocusModal.Body>
            <FocusModal.Footer>{actions(FocusModal.Close)}</FocusModal.Footer>
          </form>
        </FocusModal.Content>
      </FocusModal>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <form onSubmit={save} className="flex flex-1 flex-col overflow-hidden">
          <DrawerHeader>
            <Drawer.Title asChild>
              <Heading>{title}</Heading>
            </Drawer.Title>
            <Drawer.Description className="txt-small text-ui-fg-subtle">
              {section}
            </Drawer.Description>
          </DrawerHeader>
          <Drawer.Body className="overflow-y-auto">{fields}</Drawer.Body>
          <Drawer.Footer>{actions(Drawer.Close)}</Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  );
};

const MergeMakeDrawer = ({
  make,
  onClose,
  reload,
}: {
  make: Row | null;
  onClose: () => void;
  reload: () => Promise<void>;
}) => {
  const { t } = useTranslation('carlabAdmin');
  const writing = useWriting();
  const [into, setInto] = useState({ id: '', name: '' });
  const [saving, setSaving] = useState(false);
  const name = String(make?.name ?? '');

  useEffect(() => {
    if (make) setInto({ id: '', name: '' });
  }, [make]);

  const merge = async (event: FormEvent) => {
    event.preventDefault();
    if (!make) return;
    setSaving(true);
    const merged = await adminFetch(
      `/admin/makes/${make.id}/merge`,
      acknowledged,
      { method: 'POST', body: JSON.stringify({ into: into.id }) },
    );
    setSaving(false);
    if (merged) {
      toast.success(t('vehicles.merge.merged', { name, into: into.name }));
      onClose();
      await reload();
    }
  };

  return (
    <Drawer open={Boolean(make)} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <form onSubmit={merge} className="flex flex-1 flex-col overflow-hidden">
          <DrawerHeader>
            <Drawer.Title asChild>
              <Heading>{t('vehicles.merge.title', { name })}</Heading>
            </Drawer.Title>
            <Drawer.Description className="txt-small text-ui-fg-subtle">
              {t('vehicles.merge.description')}
            </Drawer.Description>
          </DrawerHeader>
          <Drawer.Body className="flex flex-col gap-y-2 overflow-y-auto">
            <Label size="small" weight="plus" htmlFor="merge-make-into">
              {t('vehicles.merge.into')}
            </Label>
            <ReferencePicker
              id="merge-make-into"
              path="makes"
              collection="makes"
              label={into.name}
              exclude={make?.id}
              optionLabel={(option) => String(option.name)}
              onChange={(id, label) => setInto({ id, name: label })}
            />
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button size="small" variant="secondary" disabled={saving}>
                {t('vehicles.cancel')}
              </Button>
            </Drawer.Close>
            <Button
              size="small"
              type="submit"
              variant="danger"
              isLoading={saving}
              disabled={writing || !into.id}
            >
              {t('vehicles.merge.save')}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  );
};

const VehiclesPage = () => {
  const { t } = useTranslation('carlabAdmin');
  const writing = useWriting();
  const [listing, setListing] = useState<Listing | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<{ open: boolean; row: Row | null }>({
    open: false,
    row: null,
  });
  const [merging, setMerging] = useState<Row | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const active =
    ENTITIES.find(({ path }) => path === searchParams.get('tab')) ??
    ENTITIES[0];
  const q = searchParams.get('q') ?? '';
  const pageIndex = Math.max(0, Number(searchParams.get('page')) || 0);
  const [query, setQuery] = useState(q);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries({ page: '', ...changes })) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const reload = async () => {
    const search = new URLSearchParams({
      offset: String(pageIndex * PAGE_SIZE),
      limit: String(PAGE_SIZE),
    });
    if (q) search.set('q', q);
    const data = await adminFetch(
      `/admin/${active.path}?${search}`,
      listingSchema(active.collection),
    );
    if (data) {
      setListing({
        rows: z.array(rowSchema).parse(data.rows),
        count: data.count,
      });
    }
  };

  useEffect(() => {
    setListing(null);
    reload();
  }, [active.path, q, pageIndex]);

  useEffect(() => {
    const typed = query.trim();
    if (typed === q) return;
    const timer = setTimeout(() => update({ q: typed }), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    adminFetch('/admin/suppliers', suppliersSchema).then((data) => {
      if (data) setSuppliers(data.suppliers);
    });
    tabsRef.current
      ?.querySelector('[role="tab"][data-state="active"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, []);

  const pageCount = Math.max(1, Math.ceil((listing?.count ?? 0) / PAGE_SIZE));

  return (
    <Container className="overflow-hidden p-0">
      <Tabs
        value={active.path}
        onValueChange={(next) => {
          setQuery('');
          setSearchParams({ tab: next }, { replace: true });
        }}
        className="divide-y"
      >
        <ListHeader
          heading={t('vehicles.heading')}
          level="h1"
          action={
            <Button
              size="small"
              variant="secondary"
              disabled={writing}
              onClick={() => setForm({ open: true, row: null })}
            >
              {t('vehicles.create')}
            </Button>
          }
        >
          <div ref={tabsRef} className="flex flex-col gap-3">
            <ScrollArea>
              <Tabs.List
                aria-label={t('vehicles.sections')}
                className="w-max p-0.5"
              >
                {ENTITIES.map((entity) => (
                  <Tabs.Trigger
                    key={entity.path}
                    value={entity.path}
                    className="gap-x-1.5 whitespace-nowrap"
                  >
                    {t(`vehicles.entities.${entity.object}`)}
                    <span className="text-ui-fg-muted inline-block min-w-[1ch] tabular-nums">
                      {entity === active ? listing?.count : null}
                    </span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </ScrollArea>
            <Input
              type="search"
              className="sm:w-80"
              aria-label={t('vehicles.searchLabel')}
              placeholder={t('vehicles.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </ListHeader>
        {ENTITIES.map((entity) => (
          <Tabs.Content key={entity.path} value={entity.path}>
            {entity === active && (
              <>
                <EntityTable
                  entity={entity}
                  list={listing?.rows ?? null}
                  suppliers={suppliers}
                  reload={reload}
                  onEdit={(row) => setForm({ open: true, row })}
                  onMerge={setMerging}
                />
                {listing && listing.count > PAGE_SIZE && (
                  <Table.Pagination
                    count={listing.count}
                    pageSize={PAGE_SIZE}
                    pageIndex={pageIndex}
                    pageCount={pageCount}
                    canPreviousPage={pageIndex > 0}
                    canNextPage={pageIndex + 1 < pageCount}
                    previousPage={() => update({ page: String(pageIndex - 1) })}
                    nextPage={() => update({ page: String(pageIndex + 1) })}
                    translations={{
                      of: t('parts.pagination.of'),
                      results: t('vehicles.results'),
                      pages: t('parts.pagination.pages'),
                      prev: t('parts.pagination.prev'),
                      next: t('parts.pagination.next'),
                    }}
                  />
                )}
              </>
            )}
          </Tabs.Content>
        ))}
      </Tabs>
      <EntityForm
        entity={active}
        row={form.row}
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        reload={reload}
      />
      <MergeMakeDrawer
        make={merging}
        onClose={() => setMerging(null)}
        reload={reload}
      />
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.vehicles',
  icon: TruckFast,
  rank: 5,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.vehicles');

export default VehiclesPage;
