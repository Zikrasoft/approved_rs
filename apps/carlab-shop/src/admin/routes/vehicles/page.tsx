import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Table,
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
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import { TranslationsDrawer } from '../../components/translations-drawer';
import {
  acknowledged,
  adminFetch,
  editedBySchema,
} from '../../lib/admin-fetch';

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

const identifiersSchema = z.array(z.object({ value: z.string() })).optional();

const rowLabel = (collection: string, row: Row, rows: Rows): string => {
  const ref = (key: string, target: string) =>
    rows[target]?.find(({ id }) => id === row[key]);
  switch (collection) {
    case 'chassis':
      return String(row.code);
    case 'engines':
      return String(row.code);
    case 'vehicles': {
      const model = ref('model_id', 'vehicle_models');
      const engine = ref('engine_id', 'engines');
      const codes = identifiersSchema
        .parse(row.identifiers)
        ?.map(({ value }) => value)
        .join(', ');
      return `${model?.name ?? ''} ${engine?.code ?? ''} ${codes ? `(${codes})` : ''}`.trim();
    }
    default:
      return String(row.name ?? row.value ?? row.id);
  }
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
  const { t } = useTranslation('carlabAdmin');
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
        label: rowLabel(field.collection, row, rows),
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
      reset();
      await reload();
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t('vehicles.confirmDelete'))) return;
    if (
      await adminFetch(`/admin/${entity.path}/${id}`, acknowledged, {
        method: 'DELETE',
      })
    ) {
      await reload();
    }
  };

  return (
    <div className="flex flex-col gap-y-3">
      <Heading level="h2">{t(`vehicles.entities.${entity.object}`)}</Heading>
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
                <Table.Cell key={field.key}>{cell(field, row)}</Table.Cell>
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
                    size="small"
                    variant="danger"
                    onClick={() => remove(row.id)}
                  >
                    {t('vehicles.delete')}
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {entity.fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-y-1">
            <Label size="xsmall">{t(`vehicles.fields.${field.key}`)}</Label>
            {field.kind === 'text' || field.kind === 'number' ? (
              <Input
                type={field.kind}
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
      <div className="flex gap-x-2">
        <Button onClick={save}>
          {editingId ? t('vehicles.save') : t('vehicles.create')}
        </Button>
        {editingId && (
          <Button variant="secondary" onClick={reset}>
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

  return (
    <Container className="flex flex-col gap-y-10">
      <Heading level="h1">{t('vehicles.heading')}</Heading>
      {ENTITIES.map((entity) => (
        <EntitySection
          key={entity.collection}
          entity={entity}
          rows={rows}
          reload={reload}
        />
      ))}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.vehicles',
  translationNs: 'carlabAdmin',
});

export default VehiclesPage;
