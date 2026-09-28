import { defineWidgetConfig } from '@medusajs/admin-sdk';
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import {
  type Field,
  type ProductTypeDef,
  productType,
} from '@podbor/shop-catalog/browser';
import { useEffect, useState } from 'react';

import {
  type FormValues,
  fitmentToText,
  formToSpec,
  specToForm,
  textToFitment,
} from '../../lib/spec-form';

type Loaded = { type: ProductTypeDef; values: FormValues; fitment: string };

const ask = async (path: string, init?: RequestInit) => {
  const response = await fetch(path, { credentials: 'include', ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? 'Сервер не ответил. Попробуйте ещё раз.');
  }
  return body;
};

const FieldInput = ({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) => {
  if (field.kind === 'enum') {
    return (
      <select
        id={field.key}
        className="bg-ui-bg-field border-ui-border-base txt-compact-small rounded-md border px-2 py-1.5"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">—</option>
        {field.values.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === 'boolean') {
    return (
      <input
        id={field.key}
        type="checkbox"
        checked={value === 'true'}
        onChange={(event) => onChange(event.target.checked ? 'true' : 'false')}
      />
    );
  }
  return (
    <Input
      id={field.key}
      value={value}
      inputMode={field.kind === 'number' ? 'decimal' : undefined}
      placeholder={
        field.kind === 'number'
          ? field.unit
          : field.kind === 'codes' && field.multiple
            ? 'Через запятую'
            : undefined
      }
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

const ProductSpecWidget = ({ data }: { data: { id: string } }) => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ask(`/admin/products/${data.id}?fields=id,metadata,*type`)
      .then(({ product }) => {
        const type = product.type?.value
          ? productType(product.type.value)
          : undefined;
        setLoaded(
          type
            ? {
                type,
                values: specToForm(type, product.metadata?.spec),
                fitment: fitmentToText(product.metadata?.fitment),
              }
            : null,
        );
      })
      .catch((error: Error) =>
        toast.error('Характеристики не загрузились', {
          description: error.message,
        }),
      );
  }, [data.id]);

  if (!loaded) {
    return null;
  }

  const { type, values, fitment } = loaded;

  const save = async () => {
    setSaving(true);
    try {
      await ask(`/admin/products/${data.id}/spec`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          spec: formToSpec(type, values),
          fitment: textToFitment(fitment),
        }),
      });
      toast.success('Характеристики сохранены', {
        description: 'На сайте они появятся после публикации.',
      });
    } catch (error) {
      toast.error('Не сохранилось', { description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Характеристики: {type.label}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          По ним строятся карточка, фильтр и посадочные страницы. Поля со
          звёздочкой обязательны для публикации.
        </Text>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-2">
        {type.fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <Label size="small" htmlFor={field.key}>
              {field.label}
              {field.required ? ' *' : ''}
            </Label>
            <FieldInput
              field={field}
              value={values[field.key] ?? ''}
              onChange={(value) =>
                setLoaded({
                  ...loaded,
                  values: { ...values, [field.key]: value },
                })
              }
            />
          </div>
        ))}
      </div>

      {type.fitment !== 'none' && (
        <div className="flex flex-col gap-1 px-6 py-4">
          <Label size="small" htmlFor="fitment">
            Подходит к машинам{type.fitment === 'required' ? ' *' : ''}
          </Label>
          <Textarea
            id="fitment"
            rows={5}
            placeholder="Toyota | Corolla | 2013-2019"
            value={fitment}
            onChange={(event) =>
              setLoaded({ ...loaded, fitment: event.target.value })
            }
          />
          <Text size="xsmall" className="text-ui-fg-subtle">
            Одна машина на строку: марка | модель | годы.
          </Text>
        </div>
      )}

      <div className="flex justify-end px-6 py-4">
        <Button onClick={save} isLoading={saving} disabled={saving}>
          Сохранить
        </Button>
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({ zone: 'product.details.after' });

export default ProductSpecWidget;
