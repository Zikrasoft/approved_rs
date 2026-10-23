import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Link as LinkIcon } from '@medusajs/icons';
import {
  Alert,
  Badge,
  Button,
  Container,
  DatePicker,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import { PartEnrichment } from '../../components/enrichment';
import { PINNED_ACTIONS } from '../../components/list';
import { ScrollArea } from '../../components/scroll-area';
import { TranslationsDrawer } from '../../components/translations-drawer';
import {
  acknowledged,
  adminFetch,
  editedBySchema,
  type RequirementConflict,
  useWriting,
} from '../../lib/admin-fetch';
import { breadcrumb } from '../../lib/breadcrumb';
import { useConfirmed } from '../../lib/confirm';
import {
  type LabelledVehicle,
  labelledVehicleSchema,
  referenceLabel,
  vehicleLabel,
} from '../../lib/vehicle-label';

const brandSchema = z.object({ id: z.string(), name: z.string() });

type Brand = z.infer<typeof brandSchema>;

const identifierSchema = z.object({
  id: z.string(),
  type: z.string(),
  brand: brandSchema,
  value: z.string(),
});

const partSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string().optional(),
  updated_by: z.string().nullable().optional(),
  identifiers: z.array(identifierSchema),
});

type Part = z.infer<typeof partSchema>;

type Identifier = z.infer<typeof identifierSchema>;

type Vehicle = LabelledVehicle;

const fitmentSchema = editedBySchema.extend({
  id: z.string(),
  vehicle_id: z.string(),
  quantity: z.number(),
  axle: z.string().nullable(),
  side: z.string().nullable(),
  production_from: z.string().nullable(),
  production_to: z.string().nullable(),
  steering: z.string().nullable(),
  gearbox: z.string().nullable(),
  note: z.string().nullable(),
  source: z.string(),
});

type Fitment = z.infer<typeof fitmentSchema>;

const referenceSchema = z.object({ id: z.string() }).loose();

type Reference = z.infer<typeof referenceSchema>;

const vehiclesSchema = z.object({ vehicles: z.array(labelledVehicleSchema) });
const brandsSchema = z.object({ brands: z.array(brandSchema) });
const referencesSchema = z.record(z.string(), z.array(referenceSchema));
const fitmentsSchema = z.object({ fitments: z.array(fitmentSchema) });
const partsSchema = z.object({
  parts: z.array(partSchema.extend(editedBySchema.shape)),
});
const createdPartSchema = z.object({ part: partSchema });
const bulkSchema = z.object({ matched: z.number(), created: z.number() });
const detachedSchema = z.object({ matched: z.number(), deleted: z.number() });

const STEERING_OPTIONS = ['left', 'right'] as const;
const GEARBOX_OPTIONS = ['manual', 'automatic'] as const;
const AXLE_OPTIONS = ['front', 'rear'] as const;
const SIDE_OPTIONS = ['left', 'right'] as const;
const IDENTIFIER_TYPES = ['oem', 'manufacturer-number', 'ean'] as const;
const ANY = 'any';

const REFERENCE_FILTERS = [
  { key: 'make_id', path: 'makes', collection: 'makes', label: 'make' },
  { key: 'series_id', path: 'series', collection: 'series', label: 'series' },
  {
    key: 'chassis_id',
    path: 'chassis',
    collection: 'chassis',
    label: 'chassis',
  },
  {
    key: 'model_id',
    path: 'vehicle-models',
    collection: 'vehicle_models',
    label: 'model',
  },
  { key: 'engine_id', path: 'engines', collection: 'engines', label: 'engine' },
] as const;

type Conditions = {
  quantity: string;
  axle: string;
  side: string;
  productionFrom: Date | null;
  productionTo: Date | null;
  steering: string;
  gearbox: string;
  note: string;
};

const EMPTY_CONDITIONS: Conditions = {
  quantity: '1',
  axle: '',
  side: '',
  productionFrom: null,
  productionTo: null,
  steering: '',
  gearbox: '',
  note: '',
};

const pad = (value: number) => String(value).padStart(2, '0');

const calendarDay = (date: Date | null) =>
  date &&
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const localDate = (iso: string | null) => {
  if (!iso) return null;
  const utc = new Date(iso);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
};

const conditionsOf = (fitment: Fitment): Conditions => ({
  quantity: String(fitment.quantity),
  axle: fitment.axle ?? '',
  side: fitment.side ?? '',
  productionFrom: localDate(fitment.production_from),
  productionTo: localDate(fitment.production_to),
  steering: fitment.steering ?? '',
  gearbox: fitment.gearbox ?? '',
  note: fitment.note ?? '',
});

const MAX_QUANTITY = 100;

const quantityValid = (quantity: string) =>
  /^\d+$/.test(quantity.trim()) &&
  Number(quantity) >= 1 &&
  Number(quantity) <= MAX_QUANTITY;

const conditionsBody = (conditions: Conditions) => ({
  quantity: Number(conditions.quantity),
  axle: conditions.axle || null,
  side: conditions.side || null,
  production_from: calendarDay(conditions.productionFrom),
  production_to: calendarDay(conditions.productionTo),
  steering: conditions.steering || null,
  gearbox: conditions.gearbox || null,
  note: conditions.note.trim() || null,
});

const OptionSelect = ({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) => (
  <Select
    value={value || ANY}
    onValueChange={(next) => onChange(next === ANY ? '' : next)}
  >
    <Select.Trigger
      aria-label={placeholder}
      className="h-auto min-h-8 gap-x-2 text-left"
    >
      <span className="min-w-0 flex-1 break-words">
        <Select.Value placeholder={placeholder} />
      </span>
    </Select.Trigger>
    <Select.Content className="max-w-[calc(100vw-32px)]">
      <Select.Item value={ANY}>{placeholder}</Select.Item>
      {options.map((option) => (
        <Select.Item
          key={option.value}
          value={option.value}
          className="[&>span:last-child]:whitespace-normal [&>span:last-child]:break-words"
        >
          {option.label}
        </Select.Item>
      ))}
    </Select.Content>
  </Select>
);

const SHOWN_VEHICLES = 5;

const ConflictsAlert = ({
  conflicts,
  disabled,
  onConfirm,
  onCancel,
}: {
  conflicts: RequirementConflict[];
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation('carlabAdmin');
  const unit = (conflict: RequirementConflict) =>
    conflict.unit ? ` ${conflict.unit}` : '';
  const wanted = (conflict: RequirementConflict) =>
    conflict.options
      ? conflict.options.join(', ')
      : t(
          `requirements.range.${
            conflict.min !== null && conflict.max !== null
              ? 'between'
              : conflict.min !== null
                ? 'since'
                : 'until'
          }`,
          { min: conflict.min, max: conflict.max, unit: conflict.unit ?? '' },
        ).trim();
  const vehicles = ({ vehicles: all }: RequirementConflict) =>
    all.length > SHOWN_VEHICLES
      ? t('fitments.conflicts.moreVehicles', {
          vehicles: all.slice(0, SHOWN_VEHICLES).join('; '),
          count: all.length - SHOWN_VEHICLES,
        })
      : all.join('; ');
  return (
    <Alert variant="warning">
      <div className="flex flex-col gap-y-3">
        <div className="flex flex-col gap-y-1">
          <Text size="small" weight="plus">
            {t('fitments.conflicts.title')}
          </Text>
          <ul className="flex list-disc flex-col gap-y-1 pl-4">
            {conflicts.map((conflict) => (
              <li key={`${conflict.field_key}-${wanted(conflict)}`}>
                <Text size="small">
                  {t('fitments.conflicts.line', {
                    field: conflict.field,
                    value: `${conflict.value}${unit(conflict)}`,
                    wanted: wanted(conflict),
                    vehicles: vehicles(conflict),
                  })}
                </Text>
              </li>
            ))}
          </ul>
          <Text size="small" className="text-ui-fg-subtle">
            {t('fitments.conflicts.why')}
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="small" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            size="small"
            variant="danger"
            disabled={disabled}
            onClick={onConfirm}
          >
            {t('fitments.conflicts.confirm')}
          </Button>
        </div>
      </div>
    </Alert>
  );
};

const FitmentsPage = () => {
  const writing = useWriting();
  const { t, i18n } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();

  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [parts, setParts] = useState<z.infer<typeof partsSchema>['parts']>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [partName, setPartName] = useState('');

  const [newPartName, setNewPartName] = useState('');
  const [newType, setNewType] = useState<string>(IDENTIFIER_TYPES[0]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [newBrandId, setNewBrandId] = useState('');
  const [newValue, setNewValue] = useState('');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [references, setReferences] = useState<Record<string, Reference[]>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [conditions, setConditions] = useState<Conditions>(EMPTY_CONDITIONS);
  const [editing, setEditing] = useState<Fitment | null>(null);
  const [conflicts, setConflicts] = useState<RequirementConflict[]>([]);

  const [fitments, setFitments] = useState<Fitment[]>([]);

  const setCondition = <Key extends keyof Conditions>(
    key: Key,
    value: Conditions[Key],
  ) => setConditions((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    adminFetch('/admin/vehicles', vehiclesSchema).then((data) => {
      if (data) {
        setVehicles(data.vehicles);
      }
    });
    adminFetch('/admin/brands', brandsSchema).then((data) => {
      if (data) {
        setBrands(data.brands);
      }
    });
    for (const { path, collection } of REFERENCE_FILTERS) {
      adminFetch(`/admin/${path}`, referencesSchema).then((data) => {
        if (data) {
          setReferences((current) => ({
            ...current,
            [collection]: data[collection],
          }));
        }
      });
    }
  }, []);

  const loadFitments = async (partId: string) => {
    const data = await adminFetch(
      `/admin/fitments?part_id=${encodeURIComponent(partId)}`,
      fitmentsSchema,
    );
    if (data) {
      setFitments(data.fitments);
    }
  };

  useEffect(() => {
    setPartName(selectedPart?.name ?? '');
    setNewValue('');
    setEditing(null);
    setConditions(EMPTY_CONDITIONS);
    setConflicts([]);
    if (selectedPart) {
      loadFitments(selectedPart.id);
    } else {
      setFitments([]);
    }
  }, [selectedPart?.id]);

  const search = async (text = query.trim()) => {
    if (!text) {
      return;
    }
    const data = await adminFetch(
      `/admin/parts?q=${encodeURIComponent(text)}`,
      partsSchema,
    );
    if (data) {
      setParts(data.parts);
      setSearched(true);
      if (!data.parts.length) {
        setNewValue(text);
      }
    }
    return data?.parts ?? [];
  };

  const [params] = useSearchParams();
  useEffect(() => {
    if (params.get('new')) setSearched(true);
    const linked = params.get('part');
    const text = params.get('q');
    if (linked && text) {
      setQuery(text);
      search(text).then((found) => {
        const match = found?.find(({ id }) => id === linked);
        if (match) setSelectedPart(match);
      });
    }
  }, []);

  const createPart = async () => {
    const data = await adminFetch('/admin/parts', createdPartSchema, {
      method: 'POST',
      body: JSON.stringify({
        name: newPartName,
        identifiers: [{ type: newType, brand_id: newBrandId, value: newValue }],
      }),
    });
    if (!data) {
      return;
    }
    toast.success(t('fitments.partCreated', { name: data.part.name }));
    setSelectedPart(data.part);
    setParts([]);
    setSearched(false);
    setQuery('');
  };

  const renamePart = async () => {
    if (!selectedPart) return;
    const saved = await adminFetch(
      `/admin/parts/${selectedPart.id}`,
      acknowledged,
      { method: 'POST', body: JSON.stringify({ name: partName }) },
    );
    if (saved) {
      toast.success(t('fitments.partRenamed', { name: partName.trim() }));
      setSelectedPart({ ...selectedPart, name: partName.trim() });
    }
  };

  const deletePart = async () => {
    if (!selectedPart) return;
    if (
      await confirmed({
        title: t('fitments.confirmDeletePartTitle', {
          name: selectedPart.name,
        }),
        description: t('fitments.confirmDeletePartBody'),
        done: t('fitments.partDeleted', { name: selectedPart.name }),
        run: () =>
          adminFetch(`/admin/parts/${selectedPart.id}`, acknowledged, {
            method: 'DELETE',
          }),
      })
    ) {
      setSelectedPart(null);
    }
  };

  const addIdentifier = async () => {
    if (!selectedPart) return;
    const data = await adminFetch(
      `/admin/parts/${selectedPart.id}/identifiers`,
      createdPartSchema,
      {
        method: 'POST',
        body: JSON.stringify({
          type: newType,
          brand_id: newBrandId,
          value: newValue,
        }),
      },
    );
    if (data) {
      const brand = brands.find(({ id }) => id === newBrandId)?.name ?? '';
      toast.success(
        t('fitments.numberAdded', { number: `${brand} ${newValue.trim()}` }),
      );
      setSelectedPart(data.part);
      setNewValue('');
    }
  };

  const deleteLastIdentifier = async (number: string) => {
    if (!selectedPart) return;
    if (
      await confirmed({
        title: t('fitments.lastNumberTitle', { number }),
        description: t('fitments.lastNumberBody', { name: selectedPart.name }),
        confirmText: t('fitments.deleteWholePart'),
        done: t('fitments.partDeleted', { name: selectedPart.name }),
        run: () =>
          adminFetch(`/admin/parts/${selectedPart.id}`, acknowledged, {
            method: 'DELETE',
          }),
      })
    ) {
      setSelectedPart(null);
    }
  };

  const deleteIdentifier = async (identifier: Identifier) => {
    if (!selectedPart) return;
    const number = `${identifier.brand.name} ${identifier.value}`;
    if (selectedPart.identifiers.length === 1) {
      return deleteLastIdentifier(number);
    }
    if (
      await confirmed({
        title: t('fitments.confirmDeleteNumberTitle', { number }),
        description: t('fitments.confirmDeleteNumberBody'),
        done: t('fitments.numberDeleted', { number }),
        run: () =>
          adminFetch(`/admin/part-identifiers/${identifier.id}`, acknowledged, {
            method: 'DELETE',
          }),
      })
    ) {
      setSelectedPart({
        ...selectedPart,
        identifiers: selectedPart.identifiers.filter(
          ({ id }) => id !== identifier.id,
        ),
      });
    }
  };

  const setFilter = (key: string) => (value: string) => {
    setConflicts([]);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const hasFilter = Object.values(filters).some((value) => value.trim());

  const year = (value: string | undefined) =>
    value?.trim() ? Number(value) : undefined;

  const filterBody = () => ({
    part_id: selectedPart?.id,
    vehicle_id: filters.vehicle_id || undefined,
    make_id: filters.make_id || undefined,
    series_id: filters.series_id || undefined,
    chassis_id: filters.chassis_id || undefined,
    model_id: filters.model_id || undefined,
    engine_id: filters.engine_id || undefined,
    engine_family: filters.engine_family?.trim() || undefined,
    year_from: year(filters.year_from),
    year_to: year(filters.year_to),
  });

  const attach = async (confirmConflicts = false) => {
    if (!selectedPart || !hasFilter) {
      return;
    }
    setConflicts([]);
    const result = await adminFetch(
      '/admin/fitments/bulk',
      bulkSchema,
      {
        method: 'POST',
        body: JSON.stringify({
          ...filterBody(),
          ...conditionsBody(conditions),
          ...(confirmConflicts && { confirm_conflicts: true }),
        }),
      },
      undefined,
      setConflicts,
    );
    if (result) {
      toast.success(
        t('fitments.attached', {
          count: result.created,
          matched: result.matched,
        }),
      );
      await loadFitments(selectedPart.id);
    }
  };

  const detach = async () => {
    if (!selectedPart || !hasFilter) {
      return;
    }
    let deleted = 0;
    if (
      await confirmed({
        title: t('fitments.confirmDetachTitle'),
        description: t('fitments.confirmDetachBody', {
          name: selectedPart.name,
        }),
        confirmText: t('fitments.detach'),
        done: () => t('fitments.detached', { count: deleted }),
        run: async () => {
          const result = await adminFetch(
            '/admin/fitments/bulk/delete',
            detachedSchema,
            { method: 'POST', body: JSON.stringify(filterBody()) },
          );
          deleted = result?.deleted ?? 0;
          return result;
        },
      })
    ) {
      await loadFitments(selectedPart.id);
    }
  };

  const startEditing = (fitment: Fitment) => {
    setEditing(fitment);
    setConditions(conditionsOf(fitment));
  };

  const stopEditing = () => {
    setEditing(null);
    setConditions(EMPTY_CONDITIONS);
  };

  const saveFitment = async () => {
    if (!editing || !selectedPart) return;
    const saved = await adminFetch(
      `/admin/fitments/${editing.id}`,
      acknowledged,
      { method: 'POST', body: JSON.stringify(conditionsBody(conditions)) },
    );
    if (saved) {
      toast.success(t('fitments.fitmentSaved'));
      stopEditing();
      await loadFitments(selectedPart.id);
    }
  };

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const vehicleTitle = (fitment: Fitment) => {
    const vehicle = vehicleById.get(fitment.vehicle_id);
    return vehicle ? vehicleLabel(t, vehicle) : fitment.vehicle_id;
  };

  const quantityOk = quantityValid(conditions.quantity);

  const deleteFitment = async (fitment: Fitment) => {
    if (!selectedPart) return;
    if (
      await confirmed({
        title: t('fitments.confirmDeleteFitmentTitle'),
        description: t('fitments.confirmDeleteFitmentBody', {
          vehicle: vehicleTitle(fitment),
        }),
        done: t('fitments.fitmentDeleted'),
        run: () =>
          adminFetch(`/admin/fitments/${fitment.id}`, acknowledged, {
            method: 'DELETE',
          }),
      })
    ) {
      if (editing?.id === fitment.id) stopEditing();
      await loadFitments(selectedPart.id);
    }
  };

  const position = (fitment: Fitment) =>
    [
      fitment.axle && t(`fitments.axleOptions.${fitment.axle}`),
      fitment.side && t(`fitments.sideOptions.${fitment.side}`),
    ]
      .filter(Boolean)
      .join(', ') || '-';

  const day = (iso: string | null) =>
    iso && new Date(iso).toLocaleDateString(i18n.language, { timeZone: 'UTC' });

  const production = (fitment: Fitment) => {
    const from = day(fitment.production_from);
    const to = day(fitment.production_to);
    if (from && to) return t('fitments.production.between', { from, to });
    if (from) return t('fitments.production.since', { from });
    return to && t('fitments.production.until', { to });
  };

  const criteria = (fitment: Fitment) =>
    [
      fitment.steering &&
        t('fitments.steeringCriterion', {
          side: t(`fitments.steeringOptions.${fitment.steering}`),
        }),
      fitment.gearbox &&
        t('fitments.gearboxCriterion', {
          gearbox: t(`fitments.gearboxOptions.${fitment.gearbox}`),
        }),
      production(fitment),
    ]
      .filter(Boolean)
      .join(', ') || '-';

  const supplierName = (part: Part) =>
    part.source !== undefined &&
    part.source !== 'manual' &&
    !part.updated_by && (
      <Badge size="2xsmall" color="orange">
        {t('fitments.supplierName')}
      </Badge>
    );

  const identifierFields = (
    <div className="flex flex-col gap-y-1">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Select value={newType} onValueChange={setNewType}>
          <Select.Trigger aria-label={t('fitments.identifierTypePlaceholder')}>
            <Select.Value
              placeholder={t('fitments.identifierTypePlaceholder')}
            />
          </Select.Trigger>
          <Select.Content>
            {IDENTIFIER_TYPES.map((type) => (
              <Select.Item key={type} value={type}>
                {t(`fitments.identifierTypes.${type}`)}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <Select value={newBrandId} onValueChange={setNewBrandId}>
          <Select.Trigger aria-label={t('fitments.brandPlaceholder')}>
            <Select.Value placeholder={t('fitments.brandPlaceholder')} />
          </Select.Trigger>
          <Select.Content>
            {brands.map((brand) => (
              <Select.Item key={brand.id} value={brand.id}>
                {brand.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <div className="sm:col-span-2">
          <Input
            aria-label={t('fitments.numberPlaceholder')}
            placeholder={t('fitments.numberPlaceholder')}
            maxLength={50}
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
          />
        </div>
      </div>
      <Text size="xsmall" className="text-ui-fg-subtle">
        {t('fitments.identifierTypeHint')}
      </Text>
    </div>
  );

  return (
    <Container className="flex flex-col gap-y-6">
      <Heading level="h1">{t('fitments.heading')}</Heading>

      <section className="flex flex-col gap-y-2">
        <Heading level="h2">{t('fitments.step1Label')}</Heading>
        {selectedPart ? (
          <div className="flex flex-col gap-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-y-1">
                <Text weight="plus">
                  {t('fitments.identifierCount', {
                    name: selectedPart.name,
                    count: selectedPart.identifiers.length,
                  })}
                </Text>
                <PartEnrichment
                  partId={selectedPart.id}
                  version={`${fitments.length}-${selectedPart.identifiers.length}`}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <TranslationsDrawer
                  entity="part"
                  id={selectedPart.id}
                  source={{ name: selectedPart.name }}
                />
                <Button
                  disabled={writing}
                  variant="secondary"
                  size="small"
                  onClick={() => setSelectedPart(null)}
                >
                  {t('fitments.change')}
                </Button>
                <Button
                  disabled={writing}
                  variant="danger"
                  size="small"
                  onClick={deletePart}
                >
                  {t('fitments.deletePart')}
                </Button>
              </div>
            </div>
            <Label className="flex flex-col gap-y-1">
              <Text size="small">{t('fitments.partNameLabel')}</Text>
              <div className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  value={partName}
                  maxLength={200}
                  onChange={(event) => setPartName(event.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={renamePart}
                  disabled={
                    !partName.trim() ||
                    partName.trim() === selectedPart.name ||
                    writing
                  }
                >
                  {t('fitments.rename')}
                </Button>
              </div>
            </Label>
            <div className="flex flex-wrap gap-2">
              {selectedPart.identifiers.map((identifier) => (
                <Badge key={identifier.id} size="small">
                  {identifier.brand.name} {identifier.value}
                  <button
                    type="button"
                    className="ml-1"
                    aria-label={t('fitments.deleteNumber', {
                      number: `${identifier.brand.name} ${identifier.value}`,
                    })}
                    onClick={() => deleteIdentifier(identifier)}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {identifierFields}
              <Button
                variant="secondary"
                className="self-start"
                onClick={addIdentifier}
                disabled={!newBrandId || !newValue.trim() || writing}
              >
                {t('fitments.addNumber')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="sm:w-80"
                placeholder={t('fitments.searchPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && search()}
              />
              <Button
                disabled={writing}
                variant="secondary"
                onClick={() => search()}
              >
                {t('fitments.search')}
              </Button>
            </div>
            {parts.length > 0 && (
              <ScrollArea pinnedEnd>
                <Table className={PINNED_ACTIONS}>
                  <Table.Body>
                    {parts.map((part) => (
                      <Table.Row key={part.id}>
                        <Table.Cell className="min-w-[14rem] max-w-[32rem] whitespace-normal break-words">
                          <div className="flex flex-col items-start gap-y-1 py-2">
                            <Text size="small" weight="plus">
                              {part.name}
                            </Text>
                            <Text size="small" className="text-ui-fg-subtle">
                              {part.identifiers.map((identifier, index) => (
                                <Fragment key={identifier.id}>
                                  {index > 0 && ', '}
                                  <span className="whitespace-nowrap">
                                    {identifier.brand.name} {identifier.value}
                                  </span>
                                </Fragment>
                              ))}
                            </Text>
                            {supplierName(part)}
                            <EditedBy row={part} className="max-sm:hidden" />
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            disabled={writing}
                            size="small"
                            variant="secondary"
                            onClick={() => setSelectedPart(part)}
                          >
                            {t('fitments.useThisPart')}
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </ScrollArea>
            )}
            {searched && parts.length === 0 && (
              <div className="flex flex-col gap-y-2 border-t pt-2">
                {query.trim() && (
                  <Text size="small">{t('fitments.noMatch')}</Text>
                )}
                <Input
                  placeholder={t('fitments.partNamePlaceholder')}
                  value={newPartName}
                  maxLength={200}
                  onChange={(event) => setNewPartName(event.target.value)}
                />
                {identifierFields}
                <Button
                  onClick={createPart}
                  disabled={!newPartName || !newBrandId || !newValue || writing}
                >
                  {t('fitments.createPart')}
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {!editing && (
        <section className="flex flex-col gap-y-2">
          <Heading level="h2">{t('fitments.step2Label')}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {t('fitments.step2Hint')}
          </Text>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <OptionSelect
              value={filters.vehicle_id ?? ''}
              onChange={setFilter('vehicle_id')}
              placeholder={t('fitments.filters.vehicle')}
              options={vehicles.map((vehicle) => ({
                value: vehicle.id,
                label: vehicleLabel(t, vehicle),
              }))}
            />
            {REFERENCE_FILTERS.map(({ key, collection, label }) => (
              <OptionSelect
                key={key}
                value={filters[key] ?? ''}
                onChange={setFilter(key)}
                placeholder={t(`fitments.filters.${label}`)}
                options={(references[collection] ?? []).map((row) => ({
                  value: row.id,
                  label: referenceLabel(references, collection, row),
                }))}
              />
            ))}
            <Label className="flex flex-col gap-y-1">
              <Text size="small">{t('fitments.filters.engineFamily')}</Text>
              <Input
                placeholder="B47"
                value={filters.engine_family ?? ''}
                onChange={(event) =>
                  setFilter('engine_family')(event.target.value)
                }
              />
            </Label>
            <Label className="flex flex-col gap-y-1">
              <Text size="small">{t('fitments.filters.yearFrom')}</Text>
              <Input
                type="number"
                placeholder="2015"
                value={filters.year_from ?? ''}
                onChange={(event) => setFilter('year_from')(event.target.value)}
              />
            </Label>
            <Label className="flex flex-col gap-y-1">
              <Text size="small">{t('fitments.filters.yearTo')}</Text>
              <Input
                type="number"
                placeholder="2019"
                value={filters.year_to ?? ''}
                onChange={(event) => setFilter('year_to')(event.target.value)}
              />
            </Label>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-y-2">
        <Heading level="h2">
          {editing ? t('fitments.editLabel') : t('fitments.step3Label')}
        </Heading>
        {editing && (
          <Text weight="plus">
            {t('fitments.editingVehicle', {
              vehicle: vehicleTitle(editing),
            })}
          </Text>
        )}
        <Text size="small" className="text-ui-fg-subtle">
          {t('fitments.step3Hint')}
        </Text>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Label className="flex flex-col gap-y-1">
            <Text size="small">{t('fitments.quantityLabel')}</Text>
            <Input
              type="number"
              min={1}
              max={MAX_QUANTITY}
              step={1}
              required
              aria-invalid={!quantityOk}
              aria-describedby={
                quantityOk ? undefined : 'fitment-quantity-error'
              }
              value={conditions.quantity}
              onChange={(event) => setCondition('quantity', event.target.value)}
            />
            {!quantityOk && (
              <Text
                id="fitment-quantity-error"
                size="small"
                className="text-ui-fg-error"
              >
                {t('fitments.quantityInvalid')}
              </Text>
            )}
          </Label>
          <div className="flex flex-col gap-y-1">
            <Text size="small">{t('fitments.productionFromLabel')}</Text>
            <DatePicker
              aria-label={t('fitments.productionFromLabel')}
              value={conditions.productionFrom}
              onChange={(date) => setCondition('productionFrom', date)}
            />
          </div>
          <div className="flex flex-col gap-y-1">
            <Text size="small">{t('fitments.productionToLabel')}</Text>
            <DatePicker
              aria-label={t('fitments.productionToLabel')}
              value={conditions.productionTo}
              onChange={(date) => setCondition('productionTo', date)}
            />
          </div>
          <OptionSelect
            value={conditions.axle}
            onChange={(value) => setCondition('axle', value)}
            placeholder={t('fitments.axlePlaceholder')}
            options={AXLE_OPTIONS.map((value) => ({
              value,
              label: t(`fitments.axleOptions.${value}`),
            }))}
          />
          <OptionSelect
            value={conditions.side}
            onChange={(value) => setCondition('side', value)}
            placeholder={t('fitments.sidePlaceholder')}
            options={SIDE_OPTIONS.map((value) => ({
              value,
              label: t(`fitments.sideOptions.${value}`),
            }))}
          />
          <OptionSelect
            value={conditions.steering}
            onChange={(value) => setCondition('steering', value)}
            placeholder={t('fitments.steeringPlaceholder')}
            options={STEERING_OPTIONS.map((value) => ({
              value,
              label: t(`fitments.steeringOptions.${value}`),
            }))}
          />
          <OptionSelect
            value={conditions.gearbox}
            onChange={(value) => setCondition('gearbox', value)}
            placeholder={t('fitments.gearboxPlaceholder')}
            options={GEARBOX_OPTIONS.map((value) => ({
              value,
              label: t(`fitments.gearboxOptions.${value}`),
            }))}
          />
        </div>
        <Textarea
          placeholder={t('fitments.notePlaceholder')}
          value={conditions.note}
          maxLength={1000}
          onChange={(event) => setCondition('note', event.target.value)}
        />
        <Text size="small" className="text-ui-fg-subtle">
          {t('fitments.noteHint')}
        </Text>
        {editing ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={writing || !quantityOk} onClick={saveFitment}>
              {t('common.save')}
            </Button>
            <Button
              disabled={writing}
              variant="secondary"
              onClick={stopEditing}
            >
              {t('common.cancel')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-y-3">
            {conflicts.length > 0 && (
              <ConflictsAlert
                conflicts={conflicts}
                disabled={writing}
                onConfirm={() => attach(true)}
                onCancel={() => setConflicts([])}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => attach()}
                disabled={!selectedPart || !hasFilter || !quantityOk || writing}
              >
                {t('fitments.createFitment')}
              </Button>
              <Button
                variant="secondary"
                onClick={detach}
                disabled={!selectedPart || !hasFilter || writing}
              >
                {t('fitments.detach')}
              </Button>
            </div>
          </div>
        )}
      </section>

      {fitments.length > 0 && (
        <section className="flex flex-col gap-y-2">
          <Heading level="h2">{t('fitments.existingRows')}</Heading>
          <ScrollArea pinnedEnd>
            <Table className={PINNED_ACTIONS}>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>
                    {t('fitments.columns.vehicle')}
                  </Table.HeaderCell>
                  <Table.HeaderCell className="whitespace-nowrap">
                    {t('fitments.columns.quantity')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('fitments.columns.position')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('fitments.columns.criteria')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('fitments.columns.note')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    {t('fitments.columns.source')}
                  </Table.HeaderCell>
                  <Table.HeaderCell>{t('edited.column')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('common.actions')}</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {fitments.map((fitment) => {
                  return (
                    <Table.Row key={fitment.id}>
                      <Table.Cell className="whitespace-normal">
                        {vehicleTitle(fitment)}
                      </Table.Cell>
                      <Table.Cell>{fitment.quantity}</Table.Cell>
                      <Table.Cell>{position(fitment)}</Table.Cell>
                      <Table.Cell className="whitespace-normal">
                        {criteria(fitment)}
                      </Table.Cell>
                      <Table.Cell className="max-w-[16rem] whitespace-normal break-words">
                        {fitment.note ?? '-'}
                      </Table.Cell>
                      <Table.Cell>
                        {t(`sources.names.${fitment.source}`, {
                          defaultValue: fitment.source,
                        })}
                      </Table.Cell>
                      <Table.Cell>
                        <EditedBy row={fitment} />
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-wrap gap-2 py-2">
                          {fitment.note && (
                            <TranslationsDrawer
                              entity="fitment"
                              id={fitment.id}
                              source={{ note: fitment.note }}
                            />
                          )}
                          <Button
                            disabled={writing}
                            size="small"
                            variant="secondary"
                            onClick={() => startEditing(fitment)}
                          >
                            {t('fitments.edit')}
                          </Button>
                          <Button
                            disabled={writing}
                            size="small"
                            variant="danger"
                            onClick={() => deleteFitment(fitment)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </ScrollArea>
        </section>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.fitments',
  icon: LinkIcon,
  rank: 6,
  translationNs: 'carlabAdmin',
});

export const handle = breadcrumb('menu.fitments');

export default FitmentsPage;
