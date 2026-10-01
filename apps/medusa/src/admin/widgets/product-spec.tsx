import { defineWidgetConfig } from '@medusajs/admin-sdk';
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
  toast,
} from '@medusajs/ui';
import {
  type Field,
  type FitmentEntry,
  type ProductTypeDef,
  productType,
} from '@podbor/shop-catalog/browser';
import { useEffect, useState, type ComponentProps } from 'react';

import { EMPTY_ROW, readFitment, unfinishedRow } from '../../lib/fitment-form';
import { type FormValues, formToSpec, specToForm } from '../../lib/spec-form';
import { ask } from '../lib/ask';

type Loaded = {
  type: ProductTypeDef;
  values: FormValues;
  rows: FitmentEntry[];
};

const SELECT =
  'bg-ui-bg-field border-ui-border-base txt-compact-small rounded-md border px-2 py-1.5';

type LabelledInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const LabelledInput = ({
  label,
  value,
  onChange,
  ...input
}: LabelledInputProps &
  Pick<ComponentProps<typeof Input>, 'type' | 'min' | 'max'>) => (
  <label className="flex flex-col gap-1">
    <Text size="xsmall" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Input
      value={value}
      {...input}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const YearInput = (props: LabelledInputProps) => (
  <LabelledInput {...props} type="number" min={1950} max={2100} />
);

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
        className={SELECT}
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

const FitmentRows = ({
  rows,
  onChange,
}: {
  rows: FitmentEntry[];
  onChange: (rows: FitmentEntry[]) => void;
}) => (
  <>
    {rows.map((row, index) => {
      const put = (next: FitmentEntry) =>
        onChange(rows.map((current, at) => (at === index ? next : current)));
      const asYear = (value: string) => Number(value) || 0;
      return (
        <div
          key={index}
          className="grid grid-cols-2 items-end gap-2 md:grid-cols-5"
        >
          <LabelledInput
            label="Марка"
            value={row.make}
            onChange={(make) => put({ ...row, make })}
          />
          <LabelledInput
            label="Модель"
            value={row.model}
            onChange={(model) => put({ ...row, model })}
          />
          <YearInput
            label="С года"
            value={row.yearFrom ? String(row.yearFrom) : ''}
            onChange={(value) => put({ ...row, yearFrom: asYear(value) })}
          />
          <YearInput
            label="По год"
            value={row.yearTo ? String(row.yearTo) : ''}
            onChange={(value) => put({ ...row, yearTo: asYear(value) })}
          />
          <Button
            size="small"
            variant="transparent"
            onClick={() => onChange(rows.filter((_, at) => at !== index))}
          >
            Убрать
          </Button>
        </div>
      );
    })}
    <div>
      <Button
        size="small"
        variant="secondary"
        onClick={() => onChange([...rows, EMPTY_ROW])}
      >
        Добавить машину
      </Button>
    </div>
  </>
);

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
                rows: readFitment(product.metadata?.fitment),
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

  const { type, values, rows } = loaded;

  const save = async () => {
    const unfinished = unfinishedRow(rows);
    if (unfinished >= 0) {
      toast.error('Не сохранилось', {
        description: `Машина ${unfinished + 1}: заполните марку, модель и годы (с года не позже по год).`,
      });
      return;
    }
    setSaving(true);
    try {
      await ask(`/admin/products/${data.id}/spec`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          spec: formToSpec(type, values),
          fitment: rows,
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
        <div className="flex flex-col gap-3 px-6 py-4">
          <Label size="small">
            Подходит к машинам{type.fitment === 'required' ? ' *' : ''}
          </Label>
          <FitmentRows
            rows={rows}
            onChange={(next) => setLoaded({ ...loaded, rows: next })}
          />
          <Text size="xsmall" className="text-ui-fg-subtle">
            Марку и модель пишите так же, как в предыдущих товарах — по ним
            строится фильтр на сайте. Годы — от 1950 до 2100.
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
