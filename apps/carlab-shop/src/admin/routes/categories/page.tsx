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
  Textarea,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminFetch } from '../../lib/admin-fetch';

const FIELD_TYPES = [
  'number',
  'single-select',
  'multi-select',
  'boolean',
  'text',
] as const;

type FieldType = (typeof FIELD_TYPES)[number];

type FieldOption = { id: string; key: string; label: string; rank: number };

type CategoryField = {
  id: string;
  key: string;
  type: FieldType;
  unit: string | null;
  label: string;
  required: boolean;
  facet: boolean;
  rank: number;
  options: FieldOption[];
};

type Category = {
  id: string;
  slug: string;
  name: string;
  text: string;
  fields: CategoryField[];
};

type FieldDraft = {
  key: string;
  type: FieldType;
  label: string;
  unit: string;
  required: boolean;
  facet: boolean;
};

const EMPTY_FIELD: FieldDraft = {
  key: '',
  type: 'number',
  label: '',
  unit: '',
  required: false,
  facet: false,
};

const isSelect = (type: FieldType) =>
  type === 'single-select' || type === 'multi-select';

const post = <T,>(path: string, body: unknown) =>
  adminFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });

const remove = (path: string) => adminFetch(path, { method: 'DELETE' });

const OptionRow = ({
  path,
  option,
  onChange,
}: {
  path: string;
  option: FieldOption;
  onChange: () => Promise<void>;
}) => {
  const { t } = useTranslation('carlabAdmin');
  const [label, setLabel] = useState(option.label);

  return (
    <div className="flex items-center gap-x-2">
      <Badge size="small">{option.key}</Badge>
      <Input
        size="small"
        aria-label={t('categories.optionLabel')}
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <Button
        size="small"
        variant="secondary"
        disabled={!label || label === option.label}
        onClick={async () => {
          if (await post(`${path}/${option.id}`, { label })) await onChange();
        }}
      >
        {t('categories.rename')}
      </Button>
      <Button
        size="small"
        variant="transparent"
        onClick={async () => {
          if (await remove(`${path}/${option.id}`)) await onChange();
        }}
      >
        {t('categories.deleteOption')}
      </Button>
    </div>
  );
};

const FieldRow = ({
  path,
  field,
  onChange,
}: {
  path: string;
  field: CategoryField;
  onChange: () => Promise<void>;
}) => {
  const { t } = useTranslation('carlabAdmin');
  const [label, setLabel] = useState(field.label);
  const [unit, setUnit] = useState(field.unit ?? '');
  const [rank, setRank] = useState(String(field.rank));
  const [optionKey, setOptionKey] = useState('');
  const [optionLabel, setOptionLabel] = useState('');
  const optionsPath = `${path}/options`;

  const save = async (change: Record<string, unknown>) => {
    if (await post(path, change)) await onChange();
  };

  const addOption = async () => {
    const created = await post(optionsPath, {
      key: optionKey,
      label: optionLabel,
      rank: field.options.length,
    });
    if (created) {
      setOptionKey('');
      setOptionLabel('');
      await onChange();
    }
  };

  return (
    <Table.Row>
      <Table.Cell>
        <Badge size="small">{field.key}</Badge>
      </Table.Cell>
      <Table.Cell>{t(`categories.fieldTypes.${field.type}`)}</Table.Cell>
      <Table.Cell>
        <div className="flex flex-col gap-y-2 py-2">
          <Input
            size="small"
            aria-label={t('categories.fieldLabel')}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          {isSelect(field.type) && (
            <div className="flex flex-col gap-y-2">
              {field.options.map((option) => (
                <OptionRow
                  key={option.id}
                  path={optionsPath}
                  option={option}
                  onChange={onChange}
                />
              ))}
              <div className="flex gap-x-2">
                <Input
                  size="small"
                  placeholder={t('categories.optionKeyPlaceholder')}
                  value={optionKey}
                  onChange={(event) => setOptionKey(event.target.value)}
                />
                <Input
                  size="small"
                  placeholder={t('categories.optionLabelPlaceholder')}
                  value={optionLabel}
                  onChange={(event) => setOptionLabel(event.target.value)}
                />
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!optionKey || !optionLabel}
                  onClick={addOption}
                >
                  {t('categories.addOption')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Table.Cell>
      <Table.Cell>
        <Input
          size="small"
          aria-label={t('categories.unit')}
          value={unit}
          disabled={field.type !== 'number'}
          onChange={(event) => setUnit(event.target.value)}
        />
      </Table.Cell>
      <Table.Cell>
        <Checkbox
          aria-label={t('categories.required')}
          checked={field.required}
          onCheckedChange={(checked) => save({ required: checked === true })}
        />
      </Table.Cell>
      <Table.Cell>
        <Checkbox
          aria-label={t('categories.facet')}
          checked={field.facet}
          onCheckedChange={(checked) => save({ facet: checked === true })}
        />
      </Table.Cell>
      <Table.Cell>
        <Input
          size="small"
          type="number"
          aria-label={t('categories.rank')}
          value={rank}
          onChange={(event) => setRank(event.target.value)}
        />
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-col gap-y-2">
          <Button
            size="small"
            variant="secondary"
            disabled={!label}
            onClick={() =>
              save({ label, unit: unit || null, rank: Number(rank) })
            }
          >
            {t('categories.save')}
          </Button>
          <Button
            size="small"
            variant="danger"
            onClick={async () => {
              if (await remove(path)) await onChange();
            }}
          >
            {t('categories.deleteField')}
          </Button>
        </div>
      </Table.Cell>
    </Table.Row>
  );
};

const CategoryEditor = ({
  category,
  onChange,
}: {
  category: Category;
  onChange: () => Promise<void>;
}) => {
  const { t } = useTranslation('carlabAdmin');
  const [name, setName] = useState(category.name);
  const [text, setText] = useState(category.text);
  const [draft, setDraft] = useState<FieldDraft>(EMPTY_FIELD);
  const path = `/admin/categories/${category.id}`;

  const addField = async () => {
    const created = await post(`${path}/fields`, {
      key: draft.key,
      type: draft.type,
      label: draft.label,
      unit: draft.type === 'number' && draft.unit ? draft.unit : null,
      required: draft.required,
      facet: draft.facet,
      rank: category.fields.length,
    });
    if (created) {
      setDraft(EMPTY_FIELD);
      await onChange();
    }
  };

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <Heading level="h2">
          {category.name} <Badge size="small">{category.slug}</Badge>
        </Heading>
        <Label>{t('categories.name')}</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
        <Label>{t('categories.text')}</Label>
        <Textarea
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.textHint')}
        </Text>
        <div className="flex gap-x-2">
          <Button
            disabled={!name}
            onClick={async () => {
              if (await post(path, { name, text })) await onChange();
            }}
          >
            {t('categories.save')}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (await remove(path)) await onChange();
            }}
          >
            {t('categories.deleteCategory')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        <Heading level="h3">{t('categories.fieldsHeading')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.fieldsHint')}
        </Text>
        {category.fields.length === 0 ? (
          <Text>{t('categories.noFields')}</Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('categories.key')}</Table.HeaderCell>
                <Table.HeaderCell>{t('categories.type')}</Table.HeaderCell>
                <Table.HeaderCell>
                  {t('categories.fieldLabel')}
                </Table.HeaderCell>
                <Table.HeaderCell>{t('categories.unit')}</Table.HeaderCell>
                <Table.HeaderCell>{t('categories.required')}</Table.HeaderCell>
                <Table.HeaderCell>{t('categories.facet')}</Table.HeaderCell>
                <Table.HeaderCell>{t('categories.rank')}</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {category.fields.map((field) => (
                <FieldRow
                  key={`${field.id}-${field.label}-${field.unit}-${field.rank}`}
                  path={`${path}/fields/${field.id}`}
                  field={field}
                  onChange={onChange}
                />
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>{t('categories.newField')}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={t('categories.keyPlaceholder')}
            value={draft.key}
            onChange={(event) =>
              setDraft({ ...draft, key: event.target.value })
            }
          />
          <Select
            value={draft.type}
            onValueChange={(type) =>
              setDraft({ ...draft, type: type as FieldType })
            }
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {FIELD_TYPES.map((type) => (
                <Select.Item key={type} value={type}>
                  {t(`categories.fieldTypes.${type}`)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Input
            placeholder={t('categories.labelPlaceholder')}
            value={draft.label}
            onChange={(event) =>
              setDraft({ ...draft, label: event.target.value })
            }
          />
          {draft.type === 'number' && (
            <Input
              placeholder={t('categories.unitPlaceholder')}
              value={draft.unit}
              onChange={(event) =>
                setDraft({ ...draft, unit: event.target.value })
              }
            />
          )}
          <Label className="flex items-center gap-x-2">
            <Checkbox
              checked={draft.required}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, required: checked === true })
              }
            />
            {t('categories.required')}
          </Label>
          <Label className="flex items-center gap-x-2">
            <Checkbox
              checked={draft.facet}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, facet: checked === true })
              }
            />
            {t('categories.facet')}
          </Label>
          <Button
            variant="secondary"
            disabled={!draft.key || !draft.label}
            onClick={addField}
          >
            {t('categories.addField')}
          </Button>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.keyHint')}
        </Text>
      </div>
    </div>
  );
};

const CategoriesPage = () => {
  const { t } = useTranslation('carlabAdmin');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');

  const load = async () => {
    const data = await adminFetch<{ categories: Category[] }>(
      '/admin/categories',
    );
    if (data) setCategories(data.categories);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const created = await post<{ category: Category }>('/admin/categories', {
      slug,
      name,
    });
    if (created) {
      setSlug('');
      setName('');
      setSelectedId(created.category.id);
      await load();
    }
  };

  const selected = categories.find(({ id }) => id === selectedId);

  return (
    <Container className="flex flex-col gap-y-6">
      <Heading level="h1">{t('categories.heading')}</Heading>

      <div className="flex flex-col gap-y-2">
        <Label>{t('categories.createLabel')}</Label>
        <div className="flex gap-x-2">
          <Input
            placeholder={t('categories.namePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            placeholder={t('categories.slugPlaceholder')}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
          <Button onClick={create} disabled={!name || !slug}>
            {t('categories.create')}
          </Button>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('categories.slugHint')}
        </Text>
      </div>

      {categories.length === 0 ? (
        <Text>{t('categories.empty')}</Text>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              size="small"
              variant={category.id === selectedId ? 'primary' : 'secondary'}
              onClick={() => setSelectedId(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      )}

      {selected && (
        <CategoryEditor
          key={`${selected.id}-${selected.name}-${selected.text}`}
          category={selected}
          onChange={load}
        />
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.categories',
  translationNs: 'carlabAdmin',
});

export default CategoriesPage;
