import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { EditedBy } from '../../components/edited-by';
import { TranslationsDrawer } from '../../components/translations-drawer';
import { adminFetch, editedBySchema } from '../../lib/admin-fetch';

const brandSchema = z.object({ id: z.string(), name: z.string() });

type Brand = z.infer<typeof brandSchema>;

const partSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifiers: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      brand: brandSchema,
      value: z.string(),
    }),
  ),
});

type Part = z.infer<typeof partSchema>;

const vehicleSchema = z.object({
  id: z.string(),
  model: z.object({ name: z.string() }),
  engine: z.object({ code: z.string() }),
  identifiers: z.array(z.object({ value: z.string() })),
});

type Vehicle = z.infer<typeof vehicleSchema>;

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

const referenceSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  code: z.string().optional(),
});

type Reference = z.infer<typeof referenceSchema>;

const vehiclesSchema = z.object({ vehicles: z.array(vehicleSchema) });
const brandsSchema = z.object({ brands: z.array(brandSchema) });
const referencesSchema = z.record(z.string(), z.array(referenceSchema));
const fitmentsSchema = z.object({ fitments: z.array(fitmentSchema) });
const partsSchema = z.object({
  parts: z.array(partSchema.extend(editedBySchema.shape)),
});
const createdPartSchema = z.object({ part: partSchema });
const bulkSchema = z.object({ matched: z.number(), created: z.number() });

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

const vehicleLabel = (vehicle: Vehicle): string =>
  `${vehicle.model.name} ${vehicle.engine.code} (${vehicle.identifiers
    .map(({ value }) => value)
    .join(', ')})`;

const referenceLabel = (row: Reference): string =>
  [row.name, row.code].filter(Boolean).join(' ');

const day = (iso: string | null): string => iso?.slice(0, 10) ?? '';

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
    <Select.Trigger>
      <Select.Value placeholder={placeholder} />
    </Select.Trigger>
    <Select.Content>
      <Select.Item value={ANY}>{placeholder}</Select.Item>
      {options.map((option) => (
        <Select.Item key={option.value} value={option.value}>
          {option.label}
        </Select.Item>
      ))}
    </Select.Content>
  </Select>
);

const FitmentsPage = () => {
  const { t } = useTranslation('carlabAdmin');

  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [parts, setParts] = useState<z.infer<typeof partsSchema>['parts']>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);

  const [newPartName, setNewPartName] = useState('');
  const [newType, setNewType] = useState<string>(IDENTIFIER_TYPES[0]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [newBrandId, setNewBrandId] = useState('');
  const [newValue, setNewValue] = useState('');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [references, setReferences] = useState<Record<string, Reference[]>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [quantity, setQuantity] = useState('1');
  const [axle, setAxle] = useState('');
  const [side, setSide] = useState('');
  const [productionFrom, setProductionFrom] = useState('');
  const [productionTo, setProductionTo] = useState('');
  const [steering, setSteering] = useState('');
  const [gearbox, setGearbox] = useState('');
  const [note, setNote] = useState('');

  const [fitments, setFitments] = useState<Fitment[]>([]);

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
    if (selectedPart) {
      loadFitments(selectedPart.id);
    } else {
      setFitments([]);
    }
  }, [selectedPart]);

  const search = async () => {
    if (!query.trim()) {
      return;
    }
    const data = await adminFetch(
      `/admin/parts?q=${encodeURIComponent(query.trim())}`,
      partsSchema,
    );
    if (data) {
      setParts(data.parts);
      setSearched(true);
    }
  };

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
    setSelectedPart(data.part);
    setParts([]);
    setSearched(false);
    setQuery('');
  };

  const setFilter = (key: string) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const hasFilter = Object.values(filters).some((value) => value.trim());

  const year = (value: string | undefined) =>
    value?.trim() ? Number(value) : undefined;

  const attach = async () => {
    if (!selectedPart || !hasFilter) {
      return;
    }
    const result = await adminFetch('/admin/fitments/bulk', bulkSchema, {
      method: 'POST',
      body: JSON.stringify({
        part_id: selectedPart.id,
        vehicle_id: filters.vehicle_id || undefined,
        make_id: filters.make_id || undefined,
        series_id: filters.series_id || undefined,
        chassis_id: filters.chassis_id || undefined,
        model_id: filters.model_id || undefined,
        engine_id: filters.engine_id || undefined,
        engine_family: filters.engine_family?.trim() || undefined,
        year_from: year(filters.year_from),
        year_to: year(filters.year_to),
        quantity: Number(quantity) || 1,
        axle: axle || null,
        side: side || null,
        production_from: productionFrom || null,
        production_to: productionTo || null,
        steering: steering || null,
        gearbox: gearbox || null,
        note: note.trim() || null,
      }),
    });
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

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const position = (fitment: Fitment) =>
    [
      fitment.axle && t(`fitments.axleOptions.${fitment.axle}`),
      fitment.side && t(`fitments.sideOptions.${fitment.side}`),
    ]
      .filter(Boolean)
      .join(', ') || '-';

  const criteria = (fitment: Fitment) =>
    [
      fitment.steering &&
        `${t('fitments.columns.steering')}: ${t(`fitments.steeringOptions.${fitment.steering}`)}`,
      fitment.gearbox && t(`fitments.gearboxOptions.${fitment.gearbox}`),
      (fitment.production_from || fitment.production_to) &&
        `${day(fitment.production_from)}..${day(fitment.production_to)}`,
    ]
      .filter(Boolean)
      .join(', ') || '-';

  return (
    <Container className="flex flex-col gap-y-6">
      <Heading level="h1">{t('fitments.heading')}</Heading>

      <div className="flex flex-col gap-y-2">
        <Label>{t('fitments.step1Label')}</Label>
        {selectedPart ? (
          <div className="flex items-center justify-between">
            <Text>
              {t('fitments.identifierCount', {
                name: selectedPart.name,
                count: selectedPart.identifiers.length,
              })}
            </Text>
            <div className="flex gap-x-2">
              <TranslationsDrawer
                entity="part"
                id={selectedPart.id}
                source={{ name: selectedPart.name }}
              />
              <Button
                variant="secondary"
                size="small"
                onClick={() => setSelectedPart(null)}
              >
                {t('fitments.change')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-x-2">
              <Input
                placeholder={t('fitments.searchPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button onClick={search}>{t('fitments.search')}</Button>
            </div>
            {parts.length > 0 && (
              <Table>
                <Table.Body>
                  {parts.map((part) => (
                    <Table.Row key={part.id}>
                      <Table.Cell>
                        <div className="flex flex-col">
                          {part.name}
                          <EditedBy row={part} />
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {part.identifiers
                          .map(
                            (identifier) =>
                              `${identifier.brand.name} ${identifier.value}`,
                          )
                          .join(', ')}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          size="small"
                          onClick={() => setSelectedPart(part)}
                        >
                          {t('fitments.useThisPart')}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
            {searched && parts.length === 0 && (
              <div className="flex flex-col gap-y-2 border-t pt-2">
                <Text size="small">{t('fitments.noMatch')}</Text>
                <Input
                  placeholder={t('fitments.partNamePlaceholder')}
                  value={newPartName}
                  onChange={(event) => setNewPartName(event.target.value)}
                />
                <div className="flex gap-x-2">
                  <Select value={newType} onValueChange={setNewType}>
                    <Select.Trigger>
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
                    <Select.Trigger>
                      <Select.Value
                        placeholder={t('fitments.brandPlaceholder')}
                      />
                    </Select.Trigger>
                    <Select.Content>
                      {brands.map((brand) => (
                        <Select.Item key={brand.id} value={brand.id}>
                          {brand.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                  <Input
                    placeholder={t('fitments.numberPlaceholder')}
                    value={newValue}
                    onChange={(event) => setNewValue(event.target.value)}
                  />
                </div>
                <Button
                  onClick={createPart}
                  disabled={!newPartName || !newBrandId || !newValue}
                >
                  {t('fitments.createPart')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>{t('fitments.step2Label')}</Label>
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
              label: vehicleLabel(vehicle),
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
                label: referenceLabel(row),
              }))}
            />
          ))}
          <Input
            placeholder={t('fitments.filters.engineFamily')}
            value={filters.engine_family ?? ''}
            onChange={(event) => setFilter('engine_family')(event.target.value)}
          />
          <Input
            type="number"
            placeholder={t('fitments.filters.yearFrom')}
            value={filters.year_from ?? ''}
            onChange={(event) => setFilter('year_from')(event.target.value)}
          />
          <Input
            type="number"
            placeholder={t('fitments.filters.yearTo')}
            value={filters.year_to ?? ''}
            onChange={(event) => setFilter('year_to')(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>{t('fitments.step3Label')}</Label>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Label className="flex flex-col gap-y-1">
            <Text size="small">{t('fitments.quantityLabel')}</Text>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Label>
          <Label className="flex flex-col gap-y-1">
            <Text size="small">{t('fitments.productionFromLabel')}</Text>
            <Input
              type="date"
              value={productionFrom}
              onChange={(event) => setProductionFrom(event.target.value)}
            />
          </Label>
          <Label className="flex flex-col gap-y-1">
            <Text size="small">{t('fitments.productionToLabel')}</Text>
            <Input
              type="date"
              value={productionTo}
              onChange={(event) => setProductionTo(event.target.value)}
            />
          </Label>
          <OptionSelect
            value={axle}
            onChange={setAxle}
            placeholder={t('fitments.axlePlaceholder')}
            options={AXLE_OPTIONS.map((value) => ({
              value,
              label: t(`fitments.axleOptions.${value}`),
            }))}
          />
          <OptionSelect
            value={side}
            onChange={setSide}
            placeholder={t('fitments.sidePlaceholder')}
            options={SIDE_OPTIONS.map((value) => ({
              value,
              label: t(`fitments.sideOptions.${value}`),
            }))}
          />
          <OptionSelect
            value={steering}
            onChange={setSteering}
            placeholder={t('fitments.steeringPlaceholder')}
            options={STEERING_OPTIONS.map((value) => ({
              value,
              label: t(`fitments.steeringOptions.${value}`),
            }))}
          />
          <OptionSelect
            value={gearbox}
            onChange={setGearbox}
            placeholder={t('fitments.gearboxPlaceholder')}
            options={GEARBOX_OPTIONS.map((value) => ({
              value,
              label: t(`fitments.gearboxOptions.${value}`),
            }))}
          />
        </div>
        <Textarea
          placeholder={t('fitments.notePlaceholder')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Text size="small" className="text-ui-fg-subtle">
          {t('fitments.noteHint')}
        </Text>
        <Button onClick={attach} disabled={!selectedPart || !hasFilter}>
          {t('fitments.createFitment')}
        </Button>
      </div>

      {fitments.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <Label>{t('fitments.existingRows')}</Label>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>
                  {t('fitments.columns.vehicle')}
                </Table.HeaderCell>
                <Table.HeaderCell>
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
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {fitments.map((fitment) => {
                const vehicle = vehicleById.get(fitment.vehicle_id);
                return (
                  <Table.Row key={fitment.id}>
                    <Table.Cell>
                      {vehicle ? vehicleLabel(vehicle) : fitment.vehicle_id}
                    </Table.Cell>
                    <Table.Cell>{fitment.quantity}</Table.Cell>
                    <Table.Cell>{position(fitment)}</Table.Cell>
                    <Table.Cell>{criteria(fitment)}</Table.Cell>
                    <Table.Cell>{fitment.note ?? '-'}</Table.Cell>
                    <Table.Cell>{fitment.source}</Table.Cell>
                    <Table.Cell>
                      <EditedBy row={fitment} />
                    </Table.Cell>
                    <Table.Cell>
                      {fitment.note && (
                        <TranslationsDrawer
                          entity="fitment"
                          id={fitment.id}
                          source={{ note: fitment.note }}
                        />
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'menu.fitments',
  translationNs: 'carlabAdmin',
});

export default FitmentsPage;
