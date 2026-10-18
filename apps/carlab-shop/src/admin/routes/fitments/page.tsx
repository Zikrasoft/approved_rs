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
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type PartIdentifier = {
  id: string;
  type: string;
  brand: string;
  value: string;
};

type Part = {
  id: string;
  name: string;
  identifiers: PartIdentifier[];
};

type Vehicle = {
  id: string;
  make: string;
  model: string;
  engine_code: string;
  year_from: number | null;
  year_to: number | null;
};

type Fitment = {
  id: string;
  part_id: string;
  vehicle_id: string;
  steering: string | null;
  gearbox: string | null;
  source: string;
  status: string;
};

const STEERING_OPTIONS = ['left', 'right'] as const;
const GEARBOX_OPTIONS = ['manual', 'automatic'] as const;
const IDENTIFIER_TYPES = ['oem', 'manufacturer-number', 'ean'] as const;

const jsonFetch = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  return response.json();
};

const vehicleLabel = (vehicle: Vehicle): string =>
  `${vehicle.make} ${vehicle.model} (${vehicle.engine_code})`;

const FitmentsPage = () => {
  const { t } = useTranslation('carlabAdmin');

  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);

  const [newPartName, setNewPartName] = useState('');
  const [newType, setNewType] = useState<string>(IDENTIFIER_TYPES[0]);
  const [newBrand, setNewBrand] = useState('');
  const [newValue, setNewValue] = useState('');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');

  const [productionFrom, setProductionFrom] = useState('');
  const [productionTo, setProductionTo] = useState('');
  const [steering, setSteering] = useState('');
  const [gearbox, setGearbox] = useState('');

  const [fitments, setFitments] = useState<Fitment[]>([]);

  useEffect(() => {
    jsonFetch<{ vehicles: Vehicle[] }>('/admin/vehicles').then(
      ({ vehicles: data }) => setVehicles(data),
    );
  }, []);

  const loadFitments = async (partId: string, vehId: string) => {
    const { fitments: data } = await jsonFetch<{ fitments: Fitment[] }>(
      `/admin/fitments?part_id=${partId}&vehicle_id=${vehId}`,
    );
    setFitments(data);
  };

  useEffect(() => {
    if (selectedPart && vehicleId) {
      loadFitments(selectedPart.id, vehicleId);
    } else {
      setFitments([]);
    }
  }, [selectedPart, vehicleId]);

  const search = async () => {
    if (!query.trim()) {
      return;
    }
    const { parts: data } = await jsonFetch<{ parts: Part[] }>(
      `/admin/parts?q=${encodeURIComponent(query.trim())}`,
    );
    setParts(data);
    setSearched(true);
  };

  const createPart = async () => {
    const { part } = await jsonFetch<{ part: Part }>('/admin/parts', {
      method: 'POST',
      body: JSON.stringify({
        name: newPartName,
        identifier: { type: newType, brand: newBrand, value: newValue },
      }),
    });
    setSelectedPart(part);
    setParts([]);
    setSearched(false);
    setQuery('');
  };

  const createFitment = async () => {
    if (!selectedPart || !vehicleId) {
      return;
    }
    await jsonFetch('/admin/fitments', {
      method: 'POST',
      body: JSON.stringify({
        part_id: selectedPart.id,
        vehicle_id: vehicleId,
        production_from: productionFrom || null,
        production_to: productionTo || null,
        steering: steering || null,
        gearbox: gearbox || null,
      }),
    });
    await loadFitments(selectedPart.id, vehicleId);
  };

  const rejectFitment = async (id: string) => {
    await jsonFetch(`/admin/fitments/${id}/reject`, { method: 'POST' });
    if (selectedPart && vehicleId) {
      await loadFitments(selectedPart.id, vehicleId);
    }
  };

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
            <Button
              variant="secondary"
              size="small"
              onClick={() => setSelectedPart(null)}
            >
              {t('fitments.change')}
            </Button>
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
                      <Table.Cell>{part.name}</Table.Cell>
                      <Table.Cell>
                        {part.identifiers
                          .map((identifier) => identifier.value)
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
                  <Input
                    placeholder={t('fitments.brandPlaceholder')}
                    value={newBrand}
                    onChange={(event) => setNewBrand(event.target.value)}
                  />
                  <Input
                    placeholder={t('fitments.numberPlaceholder')}
                    value={newValue}
                    onChange={(event) => setNewValue(event.target.value)}
                  />
                </div>
                <Button
                  onClick={createPart}
                  disabled={!newPartName || !newBrand || !newValue}
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
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <Select.Trigger>
            <Select.Value placeholder={t('fitments.vehiclePlaceholder')} />
          </Select.Trigger>
          <Select.Content>
            {vehicles.map((vehicle) => (
              <Select.Item key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>{t('fitments.step3Label')}</Label>
        <div className="flex gap-x-2">
          <Input
            type="date"
            value={productionFrom}
            onChange={(event) => setProductionFrom(event.target.value)}
          />
          <Input
            type="date"
            value={productionTo}
            onChange={(event) => setProductionTo(event.target.value)}
          />
          <Select value={steering} onValueChange={setSteering}>
            <Select.Trigger>
              <Select.Value placeholder={t('fitments.steeringPlaceholder')} />
            </Select.Trigger>
            <Select.Content>
              {STEERING_OPTIONS.map((side) => (
                <Select.Item key={side} value={side}>
                  {t(`fitments.steeringOptions.${side}`)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Select value={gearbox} onValueChange={setGearbox}>
            <Select.Trigger>
              <Select.Value placeholder={t('fitments.gearboxPlaceholder')} />
            </Select.Trigger>
            <Select.Content>
              {GEARBOX_OPTIONS.map((type) => (
                <Select.Item key={type} value={type}>
                  {t(`fitments.gearboxOptions.${type}`)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <Button onClick={createFitment} disabled={!selectedPart || !vehicleId}>
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
                  {t('fitments.columns.source')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('fitments.columns.status')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('fitments.columns.steering')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('fitments.columns.gearbox')}
                </Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {fitments.map((fitment) => (
                <Table.Row key={fitment.id}>
                  <Table.Cell>{fitment.source}</Table.Cell>
                  <Table.Cell>
                    {fitment.status === 'active' ||
                    fitment.status === 'rejected'
                      ? t(`fitments.statusValues.${fitment.status}`)
                      : fitment.status}
                  </Table.Cell>
                  <Table.Cell>
                    {fitment.steering
                      ? t(`fitments.steeringOptions.${fitment.steering}`)
                      : '—'}
                  </Table.Cell>
                  <Table.Cell>
                    {fitment.gearbox
                      ? t(`fitments.gearboxOptions.${fitment.gearbox}`)
                      : '—'}
                  </Table.Cell>
                  <Table.Cell>
                    {fitment.status === 'active' && (
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => rejectFitment(fitment.id)}
                      >
                        {t('fitments.reject')}
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
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
