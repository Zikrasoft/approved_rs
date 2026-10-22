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
  VEHICLE_IDENTIFIER_TYPES,
} from '@podbor/catalog-contract';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import {
  LIST_TABLE,
  ListEmpty,
  ListHeader,
  RowActions,
} from '../../components/list';
import { DrawerHeader, ModalHeader } from '../../components/dialog-header';
import { ScrollArea } from '../../components/scroll-area';
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
  type TFunction,
  vehicleLabel,
} from '../../lib/vehicle-label';

const rowSchema = editedBySchema.extend({ id: z.string() }).loose();

type Row = z.infer<typeof rowSchema>;
type Rows = Record<string, Row[]>;

const rowsSchema = z.record(z.string(), z.array(rowSchema));
type Option = { value: string; label: string };

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
};

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
      { key: 'type', kind: 'enum', values: VEHICLE_IDENTIFIER_TYPES },
      { key: 'value', kind: 'text' },
    ],
  },
];

const WIDE_FORM_FIELDS = 6;

const rowLabel = (
  t: TFunction,
  rows: Rows,
  collection: string,
  row: Row,
): string => {
  const vehicle = labelledVehicleSchema.safeParse(row);
  if (collection === 'vehicles' && vehicle.success) {
    return vehicleLabel(t, vehicle.data);
  }
  return referenceLabel(rows, collection, row);
};

const slugOf = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

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

const optionsOf = (t: TFunction, rows: Rows, field: Field): Option[] => {
  if (field.kind === 'enum') {
    return field.values.map((value) => ({
      value,
      label: t(`vehicles.values.${field.key}.${value}`),
    }));
  }
  if (field.kind === 'ref') {
    return (rows[field.collection] ?? []).map((row) => ({
      value: row.id,
      label: rowLabel(t, rows, field.collection, row),
    }));
  }
  return [];
};

const EntityTable = ({
  entity,
  rows,
  reload,
  onEdit,
}: {
  entity: Entity;
  rows: Rows;
  reload: () => Promise<void>;
  onEdit: (row: Row) => void;
}) => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();
  const list = rows[entity.collection];

  const cell = (field: Field, row: Row): string => {
    const value = row[field.key];
    if (value == null || value === '') return '-';
    if (field.kind === 'text' || field.kind === 'number') return String(value);
    if (field.kind === 'ref' && field.ownName) {
      const target = rows[field.collection]?.find(({ id }) => id === value);
      if (target?.name != null) return String(target.name);
    }
    return (
      optionsOf(t, rows, field).find((option) => option.value === value)
        ?.label ?? String(value)
    );
  };

  const remove = async (row: Row) => {
    const name = rowLabel(t, rows, entity.collection, row);
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

  if (!list) return null;
  if (!list.length) return <ListEmpty hint={t('vehicles.emptyHint')} />;

  return (
    <ScrollArea>
      <Table className={LIST_TABLE}>
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
                  {cell(field, row)}
                </Table.Cell>
              ))}
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
                      name: rowLabel(t, rows, entity.collection, row),
                    })}
                    disabled={writing}
                    onEdit={() => onEdit(row)}
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
  rows,
  row,
  open,
  onOpenChange,
  reload,
}: {
  entity: Entity;
  rows: Rows;
  row: Row | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reload: () => Promise<void>;
}) => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const wide = entity.fields.length >= WIDE_FORM_FIELDS;

  useEffect(() => {
    if (open) setDraft(row ? fromRow(entity.fields, row) : {});
  }, [open, row, entity]);

  const hasSlug = entity.fields.some(({ key }) => key === 'slug');

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
      { method: 'POST', body: JSON.stringify(toBody(entity.fields, draft)) },
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
      {entity.fields.map((field) => {
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
                  {optionsOf(t, rows, field).map((option) => (
                    <Select.Item key={option.value} value={option.value}>
                      {option.label}
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

const VehiclesPage = () => {
  const { t } = useTranslation('carlabAdmin');
  const writing = useWriting();
  const [rows, setRows] = useState<Rows>({});
  const [form, setForm] = useState<{ open: boolean; row: Row | null }>({
    open: false,
    row: null,
  });
  const tabsRef = useRef<HTMLDivElement>(null);

  const reload = async () => {
    const loaded = await Promise.all(
      ENTITIES.map(async ({ collection, path }) => {
        const data = await adminFetch(`/admin/${path}`, rowsSchema);
        return [collection, data?.[collection] ?? []] as const;
      }),
    );
    setRows(Object.fromEntries(loaded));
  };

  useEffect(() => {
    reload();
    tabsRef.current
      ?.querySelector('[role="tab"][data-state="active"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const active =
    ENTITIES.find(({ path }) => path === searchParams.get('tab')) ??
    ENTITIES[0];

  return (
    <Container className="overflow-hidden p-0">
      <Tabs
        value={active.path}
        onValueChange={(next) =>
          setSearchParams({ tab: next }, { replace: true })
        }
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
          <div ref={tabsRef}>
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
                      {rows[entity.collection]?.length}
                    </span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </ScrollArea>
          </div>
        </ListHeader>
        {ENTITIES.map((entity) => (
          <Tabs.Content key={entity.path} value={entity.path}>
            <EntityTable
              entity={entity}
              rows={rows}
              reload={reload}
              onEdit={(row) => setForm({ open: true, row })}
            />
          </Tabs.Content>
        ))}
      </Tabs>
      <EntityForm
        entity={active}
        rows={rows}
        row={form.row}
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
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
