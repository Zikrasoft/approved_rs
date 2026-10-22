import { defineRouteConfig } from '@medusajs/admin-sdk';
import { TruckFast } from '@medusajs/icons';
import {
  Button,
  Container,
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
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
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
  | { key: string; kind: 'ref'; collection: string };

type Entity = {
  collection: string;
  path: string;
  object: string;
  fields: Field[];
  translatable?: string;
};

const ENTITIES: Entity[] = [
  {
    collection: 'vehicles',
    path: 'vehicles',
    object: 'vehicle',
    fields: [
      { key: 'model_id', kind: 'ref', collection: 'vehicle_models' },
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

const rowLabel = (t: TFunction, collection: string, row: Row): string => {
  const vehicle = labelledVehicleSchema.safeParse(row);
  if (collection === 'vehicles' && vehicle.success) {
    return vehicleLabel(t, vehicle.data);
  }
  return String(row.name ?? row.code ?? row.value ?? row.id);
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

const EntitySection = ({
  entity,
  rows,
  reload,
}: {
  entity: Entity;
  rows: Rows;
  reload: () => Promise<void>;
}) => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const options = (field: Field): Option[] => {
    if (field.kind === 'enum') {
      return field.values.map((value) => ({
        value,
        label: t(`vehicles.values.${field.key}.${value}`),
      }));
    }
    if (field.kind === 'ref') {
      return (rows[field.collection] ?? []).map((row) => ({
        value: row.id,
        label: rowLabel(t, field.collection, row),
      }));
    }
    return [];
  };

  const cell = (field: Field, row: Row): string => {
    const value = row[field.key];
    if (value == null || value === '') return '-';
    if (field.kind === 'text' || field.kind === 'number') return String(value);
    return (
      options(field).find((option) => option.value === value)?.label ??
      String(value)
    );
  };

  const reset = () => {
    setDraft({});
    setEditingId(null);
  };

  const save = async () => {
    const saved = await adminFetch(
      editingId
        ? `/admin/${entity.path}/${editingId}`
        : `/admin/${entity.path}`,
      acknowledged,
      { method: 'POST', body: JSON.stringify(toBody(entity.fields, draft)) },
    );
    if (saved) {
      toast.success(t('common.saved'));
      reset();
      await reload();
    }
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

  return (
    <div className="flex flex-col gap-y-3">
      <ScrollArea>
        <Table>
          <Table.Header>
            <Table.Row>
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
            {(rows[entity.collection] ?? []).map((row) => (
              <Table.Row key={row.id}>
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
                  <div className="flex gap-x-2">
                    {entity.translatable && (
                      <TranslationsDrawer
                        entity={entity.translatable}
                        id={row.id}
                        source={{ name: String(row.name ?? '') }}
                      />
                    )}
                    <Button
                      disabled={writing}
                      size="small"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(row.id);
                        setDraft(fromRow(entity.fields, row));
                      }}
                    >
                      {t('vehicles.edit')}
                    </Button>
                    <Button
                      disabled={writing}
                      size="small"
                      variant="danger"
                      onClick={() => remove(row)}
                    >
                      {t('vehicles.delete')}
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </ScrollArea>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
        {entity.fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-y-1">
            <Label size="xsmall">{t(`vehicles.fields.${field.key}`)}</Label>
            {field.kind === 'text' || field.kind === 'number' ? (
              <Input
                type={field.kind}
                maxLength={200}
                value={draft[field.key] ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, [field.key]: event.target.value })
                }
              />
            ) : (
              <Select
                value={draft[field.key] ?? ''}
                onValueChange={(value) =>
                  setDraft({ ...draft, [field.key]: value })
                }
              >
                <Select.Trigger>
                  <Select.Value placeholder={t('vehicles.choose')} />
                </Select.Trigger>
                <Select.Content>
                  {options(field).map((option) => (
                    <Select.Item key={option.value} value={option.value}>
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            )}
          </div>
        ))}
      </div>
      {entity.object === 'vehicle_identifier' && (
        <Text size="small" className="text-ui-fg-subtle">
          {t('vehicles.identifierFormat')}
        </Text>
      )}
      <div className="flex gap-x-2">
        <Button disabled={writing} onClick={save}>
          {editingId ? t('vehicles.save') : t('vehicles.create')}
        </Button>
        {editingId && (
          <Button disabled={writing} variant="secondary" onClick={reset}>
            {t('vehicles.cancel')}
          </Button>
        )}
      </div>
    </div>
  );
};

const VehiclesPage = () => {
  const { t } = useTranslation('carlabAdmin');
  const [rows, setRows] = useState<Rows>({});

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
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const tab =
    ENTITIES.find(({ path }) => path === searchParams.get('tab'))?.path ??
    ENTITIES[0].path;

  return (
    <Container className="flex flex-col gap-y-6">
      <Heading level="h1">{t('vehicles.heading')}</Heading>
      <Tabs
        value={tab}
        onValueChange={(next) =>
          setSearchParams({ tab: next }, { replace: true })
        }
        className="flex flex-col gap-y-6"
      >
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
                <span className="text-ui-fg-muted tabular-nums">
                  {rows[entity.collection]?.length}
                </span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </ScrollArea>
        {ENTITIES.map((entity) => (
          <Tabs.Content key={entity.path} value={entity.path}>
            <EntitySection entity={entity} rows={rows} reload={reload} />
          </Tabs.Content>
        ))}
      </Tabs>
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
