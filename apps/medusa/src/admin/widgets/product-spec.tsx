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
  type ProductTypeDef,
  productType,
} from '@podbor/shop-catalog/browser';
import { useEffect, useState } from 'react';

import { type FormValues, formToSpec, specToForm } from '../../lib/spec-form';
import {
  EMPTY_ROW,
  type FitmentRow,
  fitmentToRows,
  generationLabel,
  generationsOf,
  isKnownCar,
  modelsOf,
  pickGeneration,
  pickMake,
  pickModel,
  rowsToFitment,
  unfinishedRow,
  withYearFrom,
  withYearTo,
  yearsOf,
} from '../../lib/vehicle-form';
import type { VehicleTree } from '../../lib/vehicle-tree';
import { ask } from '../lib/ask';

type Loaded = {
  type: ProductTypeDef;
  values: FormValues;
  rows: FitmentRow[];
  tree: VehicleTree;
};

type Option = { value: string; label: string };

const SELECT =
  'bg-ui-bg-field border-ui-border-base txt-compact-small rounded-md border px-2 py-1.5';

const asOptions = (values: readonly (string | number)[]): Option[] =>
  values.map((value) => ({ value: String(value), label: String(value) }));

const Choice = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-1">
    <Text size="xsmall" className="text-ui-fg-subtle">
      {label}
    </Text>
    <select
      className={SELECT}
      value={value}
      disabled={!options.length}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">—</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
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
  tree,
  rows,
  onChange,
}: {
  tree: VehicleTree;
  rows: FitmentRow[];
  onChange: (rows: FitmentRow[]) => void;
}) => (
  <>
    {rows.map((row, index) => {
      const put = (next: FitmentRow) =>
        onChange(rows.map((current, at) => (at === index ? next : current)));
      const years = asOptions(yearsOf(tree, row));
      return (
        <div key={index} className="flex flex-col gap-1">
          <div className="grid grid-cols-2 items-end gap-2 md:grid-cols-6">
            <Choice
              label="Марка"
              value={row.make}
              options={asOptions(tree.map((make) => make.name))}
              onChange={(make) => put(pickMake(make))}
            />
            <Choice
              label="Модель"
              value={row.model}
              options={asOptions(
                modelsOf(tree, row.make).map((model) => model.name),
              )}
              onChange={(model) => put(pickModel(row, model))}
            />
            <Choice
              label="Поколение"
              value={row.generation}
              options={generationsOf(tree, row.make, row.model).map(
                (generation) => ({
                  value: generation.name,
                  label: generationLabel(generation),
                }),
              )}
              onChange={(name) => put(pickGeneration(tree, row, name))}
            />
            <Choice
              label="С года"
              value={row.generation ? String(row.yearFrom) : ''}
              options={years}
              onChange={(year) => year && put(withYearFrom(row, Number(year)))}
            />
            <Choice
              label="По год"
              value={row.generation ? String(row.yearTo) : ''}
              options={years}
              onChange={(year) => year && put(withYearTo(row, Number(year)))}
            />
            <Button
              size="small"
              variant="transparent"
              onClick={() => onChange(rows.filter((_, at) => at !== index))}
            >
              Убрать
            </Button>
          </div>
          {!row.generation && row.yearFrom > 0 && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {isKnownCar(tree, row) ? (
                <>
                  Сохранено: {row.make} {row.model} {row.yearFrom}–{row.yearTo}.
                  Поколение не выбрано — выберите его, чтобы поменять годы.
                </>
              ) : (
                <>
                  Этой машины нет в справочнике — добавьте её на странице
                  «Автомобили» или удалите строку.
                </>
              )}
            </Text>
          )}
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
    Promise.all([
      ask(`/admin/products/${data.id}?fields=id,metadata,*type`),
      ask('/admin/vehicles'),
    ])
      .then(([{ product }, { makes }]) => {
        const type = product.type?.value
          ? productType(product.type.value)
          : undefined;
        setLoaded(
          type
            ? {
                type,
                values: specToForm(type, product.metadata?.spec),
                rows: fitmentToRows(makes, product.metadata?.fitment),
                tree: makes,
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

  const { type, values, rows, tree } = loaded;

  const save = async () => {
    const unfinished = unfinishedRow(rows);
    if (unfinished >= 0) {
      toast.error('Не сохранилось', {
        description: `Машина ${unfinished + 1}: выберите марку, модель и поколение.`,
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
          fitment: rowsToFitment(rows),
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
            tree={tree}
            rows={rows}
            onChange={(next) => setLoaded({ ...loaded, rows: next })}
          />
          <Text size="xsmall" className="text-ui-fg-subtle">
            Машины берутся из справочника «Автомобили». Годы подставляются из
            поколения: их можно сузить, но не расширить.
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
