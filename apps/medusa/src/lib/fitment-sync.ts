import type { PART_IDENTIFIER_TYPES } from '../modules/part/models/part-identifier';
import type PartModuleService from '../modules/part/service';
import type {
  FITMENT_GEARBOX_TYPES,
  FITMENT_STEERING_SIDES,
} from '../modules/vehicle/models/fitment';
import type { VEHICLE_IDENTIFIER_TYPES } from '../modules/vehicle/models/vehicle-identifier';
import type VehicleModuleService from '../modules/vehicle/service';

type PartIdentifierType = (typeof PART_IDENTIFIER_TYPES)[number];
type VehicleIdentifierType = (typeof VEHICLE_IDENTIFIER_TYPES)[number];
type FitmentSteeringSide = (typeof FITMENT_STEERING_SIDES)[number];
type FitmentGearboxType = (typeof FITMENT_GEARBOX_TYPES)[number];

export interface IncomingFitment {
  partIdentifier: {
    type: PartIdentifierType;
    brand: string;
    value: string;
  };
  vehicleIdentifier: {
    type: VehicleIdentifierType;
    value: string;
  };
  productionFrom: Date | null;
  productionTo: Date | null;
  steering: FitmentSteeringSide | null;
  gearbox: FitmentGearboxType | null;
}

export interface FitmentFeed {
  vendor: string;
  fetchRows(): Promise<IncomingFitment[]> | IncomingFitment[];
}

export interface ExistingFitmentRow {
  id: string;
  source: string;
  status: 'active' | 'rejected';
}

export type FitmentSyncAction =
  { type: 'skip' } | { type: 'create' } | { type: 'update'; id: string };

export function decideFitmentSyncAction(
  existingRows: ExistingFitmentRow[],
  vendor: string,
): FitmentSyncAction {
  if (existingRows.some((row) => row.source === 'manual')) {
    return { type: 'skip' };
  }

  const ownRow = existingRows.find((row) => row.source === `auto:${vendor}`);
  if (!ownRow) return { type: 'create' };
  if (ownRow.status === 'rejected') return { type: 'skip' };

  return { type: 'update', id: ownRow.id };
}

export interface FitmentSyncSummary {
  created: number;
  updated: number;
  skipped: number;
  unresolved: number;
}

export async function runFitmentSync(
  feed: FitmentFeed,
  partModuleService: PartModuleService,
  vehicleModuleService: VehicleModuleService,
): Promise<FitmentSyncSummary> {
  const rows = await feed.fetchRows();
  const summary: FitmentSyncSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    unresolved: 0,
  };

  for (const row of rows) {
    const [partIdentifier] = await partModuleService.listPartIdentifiers(
      row.partIdentifier,
    );
    const [vehicleIdentifier] =
      await vehicleModuleService.listVehicleIdentifiers(row.vehicleIdentifier);

    if (!partIdentifier || !vehicleIdentifier) {
      summary.unresolved += 1;
      continue;
    }

    const existingRows = await vehicleModuleService.listFitments({
      part_id: partIdentifier.part_id,
      vehicle_id: vehicleIdentifier.vehicle_id,
    });

    const action = decideFitmentSyncAction(existingRows, feed.vendor);

    if (action.type === 'skip') {
      summary.skipped += 1;
      continue;
    }

    const fields = {
      part_id: partIdentifier.part_id,
      vehicle_id: vehicleIdentifier.vehicle_id,
      production_from: row.productionFrom,
      production_to: row.productionTo,
      steering: row.steering,
      gearbox: row.gearbox,
      source: `auto:${feed.vendor}`,
      status: 'active' as const,
    };

    if (action.type === 'create') {
      await vehicleModuleService.createFitments(fields);
      summary.created += 1;
    } else {
      await vehicleModuleService.updateFitments({ id: action.id, ...fields });
      summary.updated += 1;
    }
  }

  return summary;
}
