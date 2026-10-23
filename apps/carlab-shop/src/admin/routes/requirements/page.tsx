import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ListCheckbox } from '@medusajs/icons';
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import { ListLoading, PINNED_ACTIONS } from '../../components/list';
import { ScrollArea } from '../../components/scroll-area';
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

const OWNERS = [
  { key: 'engine_id', path: 'engines', collection: 'engines' },
  { key: 'chassis_id', path: 'chassis', collection: 'chassis' },
  { key: 'vehicle_id', path: 'vehicles', collection: 'vehicles' },
] as const;

type OwnerKey = (typeof OWNERS)[number]['key'];

const ownerRowSchema = z
  .object({ id: z.string(), code: z.string().optional() })
  .loose();

type OwnerRow = z.infer<typeof ownerRowSchema>;

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  fields: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      type: z.string(),
      unit: z.string().nullable(),
      label: z.string(),
      options: z.array(z.object({ key: z.string(), label: z.string() })),
    }),
  ),
});

type Category = z.infer<typeof categorySchema>;

const requirementSchema = editedBySchema.extend({
  id: z.string(),
  option_keys: z.array(z.string()).nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  quantity: z.number(),
  field: z.object({
    id: z.string(),
    label: z.string(),
    unit: z.string().nullable(),
    category: z.object({ id: z.string(), name: z.string() }),
  }),
});

type Requirement = z.infer<typeof requirementSchema>;

const ownersSchema = z.record(z.string(), z.array(ownerRowSchema));
const categoriesSchema = z.object({ categories: z.array(categorySchema) });
const requirementsSchema = z.object({
  requirements: z.array(requirementSchema),
});

type Draft = {
  categoryId: string;
  fieldId: string;
  optionKeys: string[];
  values: string;
  min: string;
  max: string;
  quantity: string;
};

const EMPTY_DRAFT: Draft = {
  categoryId: '',
  fieldId: '',
  optionKeys: [],
  values: '',
  min: '',
  max: '',
  quantity: '1',
};

const ownerLabel = (t: TFunction, row: OwnerRow) => {
  const vehicle = labelledVehicleSchema.safeParse(row);
  return vehicle.success ? vehicleLabel(t, vehicle.data) : (row.code ?? row.id);
};

const numberOrNull = (value: string) =>
  value.trim() === '' ? null : Number(value);

const BOOLEAN_KEYS = ['true', 'false'] as const;

const RequirementsPage = () => {
  const writing = useWriting();
  const { t, i18n } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();
  const [ownerKey, setOwnerKey] = useState<OwnerKey>('engine_id');
  const [owners, setOwners] = useState<Record<string, OwnerRow[]>>({});
  const [ownerId, setOwnerId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loadedOwner, setLoadedOwner] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    Promise.all(
      OWNERS.map(async ({ path, collection }) => [
        collection,
        (await adminFetch(`/admin/${path}`, ownersSchema))?.[collection] ?? [],
      ]),
    ).then((loaded) => setOwners(Object.fromEntries(loaded)));
    adminFetch('/admin/categories', categoriesSchema).then(
      (data) => data && setCategories(data.categories),
    );
  }, []);

  const loadRequirements = async () => {
    if (!ownerId) return setRequirements([]);
    const data = await adminFetch(
      `/admin/requirements?${ownerKey}=${encodeURIComponent(ownerId)}`,
      requirementsSchema,
    );
    if (data) {
      setRequirements(data.requirements);
      setLoadedOwner(ownerId);
    }
  };

  useEffect(() => {
    loadRequirements();
  }, [ownerKey, ownerId]);

  const condition = ({ option_keys, min, max, field }: Requirement) => {
    if (option_keys) {
      const definition = categories
        .find(({ id }) => id === field.category.id)
        ?.fields.find(({ id }) => id === field.id);
      const options = definition?.options ?? [];
      return option_keys
        .map((key) =>
          definition?.type === 'boolean'
            ? t(`requirements.boolean.${key}`, { defaultValue: key })
            : (options.find((option) => option.key === key)?.label ?? key),
        )
        .join(', ');
    }
    if (min === null && max === null) return '-';
    const kind = min === null ? 'until' : max === null ? 'since' : 'between';
    return t(`requirements.range.${kind}`, {
      min: min?.toLocaleString(i18n.language),
      max: max?.toLocaleString(i18n.language),
      unit: field.unit ?? '',
    }).trim();
  };

  const owner = OWNERS.find(({ key }) => key === ownerKey)!;
  const category = categories.find(({ id }) => id === draft.categoryId);
  const field = category?.fields.find(({ id }) => id === draft.fieldId);
  const isSelect = field?.type.endsWith('select') ?? false;
  const withUnit = (label: string) =>
    [label, field?.unit].filter(Boolean).join(', ');

  const add = async () => {
    if (!field) return;
    const min = numberOrNull(draft.min);
    const max = numberOrNull(draft.max);
    if (field.type === 'number' && min === null && max === null) {
      toast.error(t('requirements.boundsRequired'));
      return;
    }
    if (min !== null && max !== null && min > max) {
      toast.error(t('requirements.boundsInverted'));
      return;
    }
    const optionKeys = isSelect
      ? draft.optionKeys
      : draft.values
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
    const created = await adminFetch('/admin/requirements', acknowledged, {
      method: 'POST',
      body: JSON.stringify({
        field_id: field.id,
        [ownerKey]: ownerId,
        option_keys: field.type === 'number' ? null : optionKeys,
        min: field.type === 'number' ? min : null,
        max: field.type === 'number' ? max : null,
        quantity: Number(draft.quantity),
      }),
    });
    if (created) {
      toast.success(t('requirements.added'));
      setDraft(EMPTY_DRAFT);
      await loadRequirements();
    }
  };

  const remove = async (requirement: Requirement) => {
    if (
      await confirmed({
        title: t('requirements.confirmDeleteTitle', {
          field: requirement.field.label,
        }),
        description: t('requirements.confirmDeleteBody'),
        done: t('requirements.deleted'),
        run: () =>
          adminFetch(`/admin/requirements/${requirement.id}`, acknowledged, {
            method: 'DELETE',
          }),
      })
    ) {
      await loadRequirements();
    }
  };

  return (
    <Container className="flex flex-col gap-y-6">
      <Heading level="h1">{t('requirements.heading')}</Heading>
      <Text size="small" className="text-ui-fg-subtle">
        {t('requirements.hint')}
      </Text>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall">{t('requirements.owner')}</Label>
          <Select
            value={ownerKey}
            onValueChange={(value) => {
              setOwnerKey(value as OwnerKey);
              setOwnerId('');
            }}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {OWNERS.map(({ key }) => (
                <Select.Item key={key} value={key}>
                  {t(`requirements.ownerKinds.${key}`)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall">
            {t(`requirements.ownerKinds.${ownerKey}`)}
          </Label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <Select.Trigger>
              <Select.Value placeholder={t('requirements.ownerPlaceholder')} />
            </Select.Trigger>
            <Select.Content>
              {(owners[owner.collection] ?? []).map((row) => (
                <Select.Item key={row.id} value={row.id}>
                  {ownerLabel(t, row)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>

      {!ownerId ? (
        <Text>{t('requirements.pickOwner')}</Text>
      ) : (
        <>
          {loadedOwner !== ownerId ? (
            <ListLoading />
          ) : requirements.length === 0 ? (
            <Text>{t('requirements.empty')}</Text>
          ) : (
            <ScrollArea pinnedEnd>
              <Table className={PINNED_ACTIONS}>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>
                      {t('requirements.category')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('requirements.field')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('requirements.options')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      {t('requirements.quantity')}
                    </Table.HeaderCell>
                    <Table.HeaderCell>{t('edited.column')}</Table.HeaderCell>
                    <Table.HeaderCell />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {requirements.map((requirement) => (
                    <Table.Row key={requirement.id}>
                      <Table.Cell>{requirement.field.category.name}</Table.Cell>
                      <Table.Cell>{requirement.field.label}</Table.Cell>
                      <Table.Cell>{condition(requirement)}</Table.Cell>
                      <Table.Cell>{requirement.quantity}</Table.Cell>
                      <Table.Cell>
                        <EditedBy row={requirement} />
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          disabled={writing}
                          size="small"
                          variant="transparent"
                          onClick={() => remove(requirement)}
                        >
                          {t('requirements.delete')}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </ScrollArea>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-y-1">
              <Label size="xsmall">{t('requirements.category')}</Label>
              <Select
                value={draft.categoryId}
                onValueChange={(categoryId) =>
                  setDraft({ ...EMPTY_DRAFT, categoryId })
                }
              >
                <Select.Trigger>
                  <Select.Value
                    placeholder={t('requirements.ownerPlaceholder')}
                  />
                </Select.Trigger>
                <Select.Content>
                  {categories.map(({ id, name }) => (
                    <Select.Item key={id} value={id}>
                      {name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            {category && (
              <div className="flex flex-col gap-y-1">
                <Label size="xsmall">{t('requirements.field')}</Label>
                <Select
                  value={draft.fieldId}
                  onValueChange={(fieldId) =>
                    setDraft({
                      ...EMPTY_DRAFT,
                      categoryId: category.id,
                      fieldId,
                    })
                  }
                >
                  <Select.Trigger>
                    <Select.Value
                      placeholder={t('requirements.ownerPlaceholder')}
                    />
                  </Select.Trigger>
                  <Select.Content>
                    {category.fields.map(({ id, label }) => (
                      <Select.Item key={id} value={id}>
                        {label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}
            {field?.type === 'number' && (
              <>
                <Label size="xsmall" className="flex w-40 flex-col gap-y-1">
                  {withUnit(t('requirements.min'))}
                  <Input
                    type="number"
                    aria-label={withUnit(t('requirements.min'))}
                    value={draft.min}
                    onChange={(event) =>
                      setDraft({ ...draft, min: event.target.value })
                    }
                  />
                </Label>
                <Label size="xsmall" className="flex w-40 flex-col gap-y-1">
                  {withUnit(t('requirements.max'))}
                  <Input
                    type="number"
                    aria-label={withUnit(t('requirements.max'))}
                    value={draft.max}
                    onChange={(event) =>
                      setDraft({ ...draft, max: event.target.value })
                    }
                  />
                </Label>
              </>
            )}
            {field?.type === 'boolean' && (
              <div className="flex flex-col gap-y-1">
                <Label size="xsmall">{t('requirements.values')}</Label>
                <Select
                  value={draft.values}
                  onValueChange={(values) => setDraft({ ...draft, values })}
                >
                  <Select.Trigger>
                    <Select.Value
                      placeholder={t('requirements.ownerPlaceholder')}
                    />
                  </Select.Trigger>
                  <Select.Content>
                    {BOOLEAN_KEYS.map((key) => (
                      <Select.Item key={key} value={key}>
                        {t(`requirements.boolean.${key}`)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}
            {field?.type === 'text' && (
              <Label
                size="xsmall"
                className="flex min-w-[16rem] flex-col gap-y-1"
              >
                {t('requirements.values')}
                <Input
                  value={draft.values}
                  maxLength={200}
                  onChange={(event) =>
                    setDraft({ ...draft, values: event.target.value })
                  }
                />
              </Label>
            )}
            {field && (
              <Label size="xsmall" className="flex w-32 flex-col gap-y-1">
                {t('requirements.quantity')}
                <Input
                  type="number"
                  min={1}
                  value={draft.quantity}
                  onChange={(event) =>
                    setDraft({ ...draft, quantity: event.target.value })
                  }
                />
              </Label>
            )}
          </div>
          {field && isSelect && (
            <div className="flex flex-col gap-y-2">
              <Label size="xsmall">{t('requirements.options')}</Label>
              <div className="flex flex-wrap gap-3">
                {field.options.map((option) => (
                  <Label key={option.key} className="flex items-center gap-x-2">
                    <Checkbox
                      checked={draft.optionKeys.includes(option.key)}
                      onCheckedChange={(checked) =>
                        setDraft({
                          ...draft,
                          optionKeys:
                            checked === true
                              ? [...draft.optionKeys, option.key]
                              : draft.optionKeys.filter(
                                  (key) => key !== option.key,
                                ),
                        })
                      }
                    />
                    {option.label} <Badge size="2xsmall">{option.key}</Badge>
                  </Label>
                ))}
              </div>
            </div>
          )}
          <div>
            <Button
              disabled={
                !field || !Number.isInteger(Number(draft.quantity)) || writing
              }
              onClick={add}
            >
              {t('requirements.add')}
            </Button>
          </div>
        </>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.requirements',
  icon: ListCheckbox,
  rank: 7,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.requirements');

export default RequirementsPage;
