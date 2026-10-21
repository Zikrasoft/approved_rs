import { defineRouteConfig } from '@medusajs/admin-sdk';
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
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminFetch } from '../../lib/admin-fetch';

const OWNERS = [
  { key: 'engine_id', path: 'engines', collection: 'engines' },
  { key: 'chassis_id', path: 'chassis', collection: 'chassis' },
  { key: 'vehicle_id', path: 'vehicles', collection: 'vehicles' },
] as const;

type OwnerKey = (typeof OWNERS)[number]['key'];

type OwnerRow = {
  id: string;
  code?: string;
  identifiers?: { value: string }[];
};

type Field = {
  id: string;
  key: string;
  type: string;
  unit: string | null;
  label: string;
  options: { key: string; label: string }[];
};

type Category = { id: string; name: string; fields: Field[] };

type Requirement = {
  id: string;
  option_keys: string[] | null;
  min: number | null;
  max: number | null;
  quantity: number;
  field: {
    id: string;
    label: string;
    unit: string | null;
    category: { id: string; name: string };
  };
};

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

const ownerLabel = (row: OwnerRow) =>
  row.code ?? (row.identifiers?.map(({ value }) => value).join(', ') || row.id);

const numberOrNull = (value: string) =>
  value.trim() === '' ? null : Number(value);

const condition = (requirement: Requirement, categories: Category[]) => {
  if (requirement.option_keys) {
    const options =
      categories
        .find(({ id }) => id === requirement.field.category.id)
        ?.fields.find(({ id }) => id === requirement.field.id)?.options ?? [];
    return requirement.option_keys
      .map((key) => options.find((option) => option.key === key)?.label ?? key)
      .join(', ');
  }
  const unit = requirement.field.unit ?? '';
  return `${requirement.min ?? ''} – ${requirement.max ?? ''} ${unit}`.trim();
};

const RequirementsPage = () => {
  const { t } = useTranslation('carlabAdmin');
  const [ownerKey, setOwnerKey] = useState<OwnerKey>('engine_id');
  const [owners, setOwners] = useState<Record<string, OwnerRow[]>>({});
  const [ownerId, setOwnerId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const errors = {
    'min exceeds max': t('requirements.errors.minExceedsMax'),
    'Unknown option': t('requirements.errors.unknownOption'),
  };

  useEffect(() => {
    Promise.all(
      OWNERS.map(async ({ path, collection }) => [
        collection,
        (await adminFetch<Record<string, OwnerRow[]>>(`/admin/${path}`))?.[
          collection
        ] ?? [],
      ]),
    ).then((loaded) => setOwners(Object.fromEntries(loaded)));
    adminFetch<{ categories: Category[] }>('/admin/categories').then(
      (data) => data && setCategories(data.categories),
    );
  }, []);

  const loadRequirements = async () => {
    if (!ownerId) return setRequirements([]);
    const data = await adminFetch<{ requirements: Requirement[] }>(
      `/admin/requirements?${ownerKey}=${encodeURIComponent(ownerId)}`,
    );
    if (data) setRequirements(data.requirements);
  };

  useEffect(() => {
    loadRequirements();
  }, [ownerKey, ownerId]);

  const owner = OWNERS.find(({ key }) => key === ownerKey)!;
  const category = categories.find(({ id }) => id === draft.categoryId);
  const field = category?.fields.find(({ id }) => id === draft.fieldId);
  const isSelect = field?.type.endsWith('select') ?? false;

  const add = async () => {
    if (!field) return;
    const optionKeys = isSelect
      ? draft.optionKeys
      : draft.values
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
    const created = await adminFetch(
      '/admin/requirements',
      {
        method: 'POST',
        body: JSON.stringify({
          field_id: field.id,
          [ownerKey]: ownerId,
          option_keys: field.type === 'number' ? null : optionKeys,
          min: field.type === 'number' ? numberOrNull(draft.min) : null,
          max: field.type === 'number' ? numberOrNull(draft.max) : null,
          quantity: Number(draft.quantity),
        }),
      },
      errors,
    );
    if (created) {
      setDraft(EMPTY_DRAFT);
      await loadRequirements();
    }
  };

  const remove = async (id: string) => {
    if (await adminFetch(`/admin/requirements/${id}`, { method: 'DELETE' })) {
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
                  {ownerLabel(row)}
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
          {requirements.length === 0 ? (
            <Text>{t('requirements.empty')}</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>
                    {t('requirements.category')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>{t('requirements.field')}</Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('requirements.options')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('requirements.quantity')}
                  </Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {requirements.map((requirement) => (
                  <Table.Row key={requirement.id}>
                    <Table.Cell>{requirement.field.category.name}</Table.Cell>
                    <Table.Cell>{requirement.field.label}</Table.Cell>
                    <Table.Cell>
                      {condition(requirement, categories)}
                    </Table.Cell>
                    <Table.Cell>{requirement.quantity}</Table.Cell>
                    <Table.Cell>
                      <Button
                        size="small"
                        variant="transparent"
                        onClick={() => remove(requirement.id)}
                      >
                        {t('requirements.delete')}
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
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
                <Input
                  type="number"
                  aria-label={t('requirements.min')}
                  placeholder={`${t('requirements.min')} ${field.unit ?? ''}`}
                  value={draft.min}
                  onChange={(event) =>
                    setDraft({ ...draft, min: event.target.value })
                  }
                />
                <Input
                  type="number"
                  aria-label={t('requirements.max')}
                  placeholder={`${t('requirements.max')} ${field.unit ?? ''}`}
                  value={draft.max}
                  onChange={(event) =>
                    setDraft({ ...draft, max: event.target.value })
                  }
                />
              </>
            )}
            {field && field.type !== 'number' && !isSelect && (
              <Input
                aria-label={t('requirements.values')}
                placeholder={t('requirements.values')}
                value={draft.values}
                onChange={(event) =>
                  setDraft({ ...draft, values: event.target.value })
                }
              />
            )}
            {field && (
              <Input
                type="number"
                min={1}
                aria-label={t('requirements.quantity')}
                placeholder={t('requirements.quantity')}
                value={draft.quantity}
                onChange={(event) =>
                  setDraft({ ...draft, quantity: event.target.value })
                }
              />
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
              disabled={!field || !Number.isInteger(Number(draft.quantity))}
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
  translationNs: 'carlabAdmin',
});

export default RequirementsPage;
