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
      <Heading level="h1">Fitment curation</Heading>

      <div className="flex flex-col gap-y-2">
        <Label>1. Find or create the Part</Label>
        {selectedPart ? (
          <div className="flex items-center justify-between">
            <Text>
              {selectedPart.name} ({selectedPart.identifiers.length}{' '}
              identifier(s))
            </Text>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setSelectedPart(null)}
            >
              Change
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-x-2">
              <Input
                placeholder="OEM / manufacturer number or brand"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button onClick={search}>Search</Button>
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
                          Use this Part
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
            {searched && parts.length === 0 && (
              <div className="flex flex-col gap-y-2 border-t pt-2">
                <Text size="small">No matching Part. Create a new one:</Text>
                <Input
                  placeholder="Part name"
                  value={newPartName}
                  onChange={(event) => setNewPartName(event.target.value)}
                />
                <div className="flex gap-x-2">
                  <Select value={newType} onValueChange={setNewType}>
                    <Select.Trigger>
                      <Select.Value placeholder="Identifier type" />
                    </Select.Trigger>
                    <Select.Content>
                      {IDENTIFIER_TYPES.map((type) => (
                        <Select.Item key={type} value={type}>
                          {type}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                  <Input
                    placeholder="Brand"
                    value={newBrand}
                    onChange={(event) => setNewBrand(event.target.value)}
                  />
                  <Input
                    placeholder="Number"
                    value={newValue}
                    onChange={(event) => setNewValue(event.target.value)}
                  />
                </div>
                <Button
                  onClick={createPart}
                  disabled={!newPartName || !newBrand || !newValue}
                >
                  Create Part
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>2. Pick the Vehicle (catalogue only)</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <Select.Trigger>
            <Select.Value placeholder="Select a Vehicle" />
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
        <Label>3. Narrowing criteria (optional)</Label>
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
              <Select.Value placeholder="Steering" />
            </Select.Trigger>
            <Select.Content>
              {STEERING_OPTIONS.map((side) => (
                <Select.Item key={side} value={side}>
                  {side}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Select value={gearbox} onValueChange={setGearbox}>
            <Select.Trigger>
              <Select.Value placeholder="Gearbox" />
            </Select.Trigger>
            <Select.Content>
              {GEARBOX_OPTIONS.map((type) => (
                <Select.Item key={type} value={type}>
                  {type}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <Button onClick={createFitment} disabled={!selectedPart || !vehicleId}>
          Create Fitment (manual, active)
        </Button>
      </div>

      {fitments.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <Label>Existing Fitment rows for this Part/Vehicle</Label>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Source</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Steering</Table.HeaderCell>
                <Table.HeaderCell>Gearbox</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {fitments.map((fitment) => (
                <Table.Row key={fitment.id}>
                  <Table.Cell>{fitment.source}</Table.Cell>
                  <Table.Cell>{fitment.status}</Table.Cell>
                  <Table.Cell>{fitment.steering ?? '—'}</Table.Cell>
                  <Table.Cell>{fitment.gearbox ?? '—'}</Table.Cell>
                  <Table.Cell>
                    {fitment.status === 'active' && (
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => rejectFitment(fitment.id)}
                      >
                        Reject
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
  label: 'Fitments',
});

export default FitmentsPage;
