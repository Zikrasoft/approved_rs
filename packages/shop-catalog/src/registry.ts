export type Unit = 'Ah' | 'A' | 'mm' | 'l' | 'months';

interface FieldBase {
  key: string;
  label: string;
  required?: boolean;
  facet?: boolean;
  card?: boolean;
  landing?: boolean;
}

export interface EnumField extends FieldBase {
  kind: 'enum';
  values: readonly { value: string; label: string }[];
}

export interface NumberField extends FieldBase {
  kind: 'number';
  unit: Unit;
  integer?: boolean;
  min?: number;
  max?: number;
}

export interface BooleanField extends FieldBase {
  kind: 'boolean';
}

export interface CodesField extends FieldBase {
  kind: 'codes';
  multiple?: boolean;
}

export type Field = EnumField | NumberField | BooleanField | CodesField;

export type FitmentRule = 'none' | 'optional' | 'required';

export interface ProductTypeDef {
  key: string;
  label: string;
  fields: readonly Field[];
  fitment: FitmentRule;
  installation?: string;
}

export type SpecValue = string | number | boolean | readonly string[];

export type Spec = Readonly<Record<string, SpecValue | undefined>>;

export const SERVICE_TYPE = 'services';

const brand: CodesField = {
  kind: 'codes',
  key: 'brand',
  label: 'Бренд',
  required: true,
  facet: true,
  card: true,
};

const oemNumbers: CodesField = {
  kind: 'codes',
  key: 'oemNumbers',
  label: 'OEM-номера',
  multiple: true,
};

const millimetres = (key: string, label: string): NumberField => ({
  kind: 'number',
  key,
  label,
  unit: 'mm',
  integer: true,
  min: 1,
  max: 1000,
  required: true,
});

const VISCOSITIES = [
  '0w-16',
  '0w-20',
  '0w-30',
  '0w-40',
  '5w-20',
  '5w-30',
  '5w-40',
  '10w-40',
  '10w-60',
  '15w-40',
];

export const PRODUCT_TYPES: readonly ProductTypeDef[] = [
  {
    key: 'batteries',
    label: 'Аккумуляторы',
    fitment: 'optional',
    installation: 'battery-installation',
    fields: [
      brand,
      {
        kind: 'number',
        key: 'capacityAh',
        label: 'Ёмкость',
        unit: 'Ah',
        integer: true,
        min: 1,
        max: 400,
        required: true,
        facet: true,
        card: true,
        landing: true,
      },
      {
        kind: 'number',
        key: 'crankingA',
        label: 'Пусковой ток',
        unit: 'A',
        integer: true,
        min: 1,
        max: 2000,
        required: true,
        facet: true,
        card: true,
      },
      {
        kind: 'enum',
        key: 'polarity',
        label: 'Полярность',
        required: true,
        facet: true,
        card: true,
        values: [
          { value: 'left', label: 'Обратная (минус слева)' },
          { value: 'right', label: 'Прямая (плюс слева)' },
        ],
      },
      {
        kind: 'enum',
        key: 'technology',
        label: 'Технология',
        facet: true,
        values: [
          { value: 'flooded', label: 'Жидкостный' },
          { value: 'efb', label: 'EFB' },
          { value: 'agm', label: 'AGM' },
        ],
      },
      millimetres('lengthMm', 'Длина'),
      millimetres('widthMm', 'Ширина'),
      millimetres('heightMm', 'Высота'),
      {
        kind: 'number',
        key: 'warrantyMonths',
        label: 'Гарантия',
        unit: 'months',
        integer: true,
        min: 1,
        max: 120,
        required: true,
      },
    ],
  },
  {
    key: 'motor-oils',
    label: 'Моторные масла',
    fitment: 'none',
    fields: [
      brand,
      {
        kind: 'enum',
        key: 'viscosity',
        label: 'Вязкость',
        required: true,
        facet: true,
        card: true,
        landing: true,
        values: VISCOSITIES.map((value) => ({
          value,
          label: value.toUpperCase(),
        })),
      },
      {
        kind: 'number',
        key: 'volumeL',
        label: 'Объём',
        unit: 'l',
        min: 0.1,
        max: 220,
        required: true,
        facet: true,
        card: true,
      },
      {
        kind: 'enum',
        key: 'base',
        label: 'Основа',
        required: true,
        facet: true,
        values: [
          { value: 'synthetic', label: 'Синтетическое' },
          { value: 'semi-synthetic', label: 'Полусинтетическое' },
          { value: 'mineral', label: 'Минеральное' },
        ],
      },
      {
        kind: 'codes',
        key: 'approvals',
        label: 'Допуски',
        multiple: true,
        facet: true,
        card: true,
      },
    ],
  },
  {
    key: 'filters',
    label: 'Фильтры',
    fitment: 'required',
    fields: [
      brand,
      {
        kind: 'enum',
        key: 'filterKind',
        label: 'Тип фильтра',
        required: true,
        facet: true,
        card: true,
        landing: true,
        values: [
          { value: 'oil', label: 'Масляный' },
          { value: 'air', label: 'Воздушный' },
          { value: 'cabin', label: 'Салонный' },
          { value: 'fuel', label: 'Топливный' },
        ],
      },
      oemNumbers,
    ],
  },
  {
    key: 'brakes',
    label: 'Тормоза',
    fitment: 'required',
    installation: 'brake-installation',
    fields: [
      brand,
      {
        kind: 'enum',
        key: 'part',
        label: 'Деталь',
        required: true,
        facet: true,
        card: true,
        landing: true,
        values: [
          { value: 'pads', label: 'Колодки' },
          { value: 'discs', label: 'Диски' },
        ],
      },
      {
        kind: 'enum',
        key: 'axle',
        label: 'Ось',
        required: true,
        facet: true,
        card: true,
        values: [
          { value: 'front', label: 'Передняя' },
          { value: 'rear', label: 'Задняя' },
        ],
      },
      {
        kind: 'number',
        key: 'diameterMm',
        label: 'Диаметр диска',
        unit: 'mm',
        integer: true,
        min: 100,
        max: 500,
      },
      oemNumbers,
    ],
  },
];

export function productType(key: string): ProductTypeDef | undefined {
  return PRODUCT_TYPES.find((type) => type.key === key);
}
