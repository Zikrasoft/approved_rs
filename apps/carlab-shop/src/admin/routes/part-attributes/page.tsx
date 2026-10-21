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
  Text,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminFetch } from '../../lib/admin-fetch';

type FieldOption = { key: string; label: string };

type CategoryField = {
  key: string;
  type: 'number' | 'single-select' | 'multi-select' | 'boolean' | 'text';
  unit: string | null;
  label: string;
  required: boolean;
  options: FieldOption[];
};

type Category = { id: string; name: string; fields: CategoryField[] };

type AttributeValue = number | boolean | string | string[];

type Part = {
  id: string;
  name: string;
  category_id: string | null;
  attributes: Record<string, AttributeValue>;
  identifiers: { id: string; value: string; brand: { name: string } }[];
};

const partLabel = (part: Part) =>
  `${part.name} (${part.identifiers
    .map((identifier) => `${identifier.brand.name} ${identifier.value}`)
    .join(', ')})`;

const ValueInput = ({
  field,
  value,
  onChange,
}: {
  field: CategoryField;
  value: AttributeValue | undefined;
  onChange: (value: AttributeValue | undefined) => void;
}) => {
  const { t } = useTranslation('carlabAdmin');

  switch (field.type) {
    case 'number':
      return (
        <Input
          type="number"
          step="any"
          value={value === undefined ? '' : String(value)}
          onChange={(event) =>
            onChange(
              event.target.value === ''
                ? undefined
                : Number(event.target.value),
            )
          }
        />
      );
    case 'text':
      return (
        <Input
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      );
    case 'boolean':
      return (
        <Select
          value={value === undefined ? '' : String(value)}
          onValueChange={(next) => onChange(next === 'true')}
        >
          <Select.Trigger>
            <Select.Value placeholder={t('partAttributes.notSet')} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="true">{t('partAttributes.yes')}</Select.Item>
            <Select.Item value="false">{t('partAttributes.no')}</Select.Item>
          </Select.Content>
        </Select>
      );
    case 'single-select':
      return (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={onChange}
        >
          <Select.Trigger>
            <Select.Value placeholder={t('partAttributes.notSet')} />
          </Select.Trigger>
          <Select.Content>
            {field.options.map((option) => (
              <Select.Item key={option.key} value={option.key}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      );
    case 'multi-select': {
      const keys = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-3">
          {field.options.map((option) => (
            <Label key={option.key} className="flex items-center gap-x-2">
              <Checkbox
                checked={keys.includes(option.key)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...keys, option.key]
                    : keys.filter((key) => key !== option.key);
                  onChange(next.length ? next : undefined);
                }}
              />
              {option.label}
            </Label>
          ))}
        </div>
      );
    }
  }
};

const PartAttributesPage = () => {
  const { t } = useTranslation('carlabAdmin');
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [part, setPart] = useState<Part | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [values, setValues] = useState<Record<string, AttributeValue>>({});

  useEffect(() => {
    adminFetch<{ categories: Category[] }>('/admin/categories').then((data) => {
      if (data) setCategories(data.categories);
    });
  }, []);

  const search = async () => {
    const data = await adminFetch<{ parts: Part[] }>(
      `/admin/parts?q=${encodeURIComponent(query)}`,
    );
    if (data) setParts(data.parts);
  };

  const choose = (chosen: Part) => {
    setPart(chosen);
    setCategoryId(chosen.category_id ?? '');
    setValues(chosen.attributes);
  };

  const setValue = (key: string, value: AttributeValue | undefined) =>
    setValues((current) =>
      Object.fromEntries([
        ...Object.entries(current).filter(([other]) => other !== key),
        ...(value === undefined ? [] : [[key, value]]),
      ]),
    );

  const save = async () => {
    if (!part) return;
    const saved = await adminFetch<{ part: Pick<Part, 'id'> }>(
      `/admin/parts/${part.id}`,
      {
        method: 'POST',
        body: JSON.stringify({
          category_id: categoryId || null,
          attributes: values,
        }),
      },
    );
    if (saved) toast.success(t('partAttributes.saved'));
  };

  const category = categories.find(({ id }) => id === categoryId);

  return (
    <Container className="flex flex-col gap-y-6">
      <Heading level="h1">{t('partAttributes.heading')}</Heading>

      <div className="flex flex-col gap-y-2">
        <Label>{t('partAttributes.findLabel')}</Label>
        <div className="flex gap-x-2">
          <Input
            placeholder={t('partAttributes.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button variant="secondary" onClick={search} disabled={!query}>
            {t('partAttributes.search')}
          </Button>
        </div>
        <div className="flex flex-col items-start gap-y-1">
          {parts.map((found) => (
            <Button
              key={found.id}
              size="small"
              variant={found.id === part?.id ? 'primary' : 'transparent'}
              onClick={() => choose(found)}
            >
              {partLabel(found)}
            </Button>
          ))}
        </div>
      </div>

      {part && (
        <div className="flex flex-col gap-y-4">
          <Heading level="h2">{partLabel(part)}</Heading>
          <div className="flex flex-col gap-y-2">
            <Label>{t('partAttributes.category')}</Label>
            <Select
              value={categoryId}
              onValueChange={(next) => {
                setCategoryId(next);
                setValues({});
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder={t('partAttributes.noCategory')} />
              </Select.Trigger>
              <Select.Content>
                {categories.map((option) => (
                  <Select.Item key={option.id} value={option.id}>
                    {option.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {category?.fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-y-2">
              <Label>
                {field.label}
                {field.unit && `, ${field.unit}`}{' '}
                {field.required && (
                  <Badge size="small">{t('partAttributes.required')}</Badge>
                )}
              </Label>
              <ValueInput
                field={field}
                value={values[field.key]}
                onChange={(value) => setValue(field.key, value)}
              />
            </div>
          ))}
          {category && category.fields.length === 0 && (
            <Text>{t('partAttributes.noFields')}</Text>
          )}

          <div>
            <Button onClick={save}>{t('partAttributes.save')}</Button>
          </div>
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.partAttributes',
  translationNs: 'carlabAdmin',
});

export default PartAttributesPage;
