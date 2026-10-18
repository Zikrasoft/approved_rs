import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { PART_MODULE } from '../../modules/part';
import type PartModuleService from '../../modules/part/service';
import { VEHICLE_MODULE } from '../../modules/vehicle';
import type VehicleModuleService from '../../modules/vehicle/service';
import { runFitmentSync } from '../fitment-sync';
import type { IncomingFitment } from '../fitment-sync';
import {
  createStubFitmentFeed,
  STUB_FITMENT_FEED_ROWS,
} from '../stub-fitment-feed';

function buildRow(suffix: string): IncomingFitment {
  return {
    partIdentifier: { type: 'oem', brand: 'ATE', value: `SYNC-OEM-${suffix}` },
    vehicleIdentifier: { type: 'ktype', value: `SYNC-KTYPE-${suffix}` },
    productionFrom: null,
    productionTo: null,
    steering: null,
    gearbox: null,
  };
}

medusaIntegrationTestRunner({
  moduleName: 'vehicle',
  testSuite: ({ getContainer }) => {
    describe('runFitmentSync (stub feed)', () => {
      let partModuleService: PartModuleService;
      let vehicleModuleService: VehicleModuleService;

      beforeAll(() => {
        partModuleService = getContainer().resolve(PART_MODULE);
        vehicleModuleService = getContainer().resolve(VEHICLE_MODULE);
      });

      async function seedPosition(row: IncomingFitment, suffix: string) {
        const part = await partModuleService.createParts({
          name: `Fitment sync test part ${suffix}`,
        });
        await partModuleService.createPartIdentifiers({
          part_id: part.id,
          ...row.partIdentifier,
        });

        const vehicle = await vehicleModuleService.createVehicles({
          make: 'BMW',
          model: '320d (F30)',
          engine_code: `FITMENT-SYNC-${suffix}`,
          year_from: 2015,
          year_to: 2018,
        });
        await vehicleModuleService.createVehicleIdentifiers({
          vehicle_id: vehicle.id,
          ...row.vehicleIdentifier,
        });

        return { partId: part.id, vehicleId: vehicle.id };
      }

      it('creates an active auto:stub row for a new position from the default fixture', async () => {
        const row = STUB_FITMENT_FEED_ROWS[0]!;
        const { partId, vehicleId } = await seedPosition(row, 'default-new');

        await runFitmentSync(
          createStubFitmentFeed(),
          partModuleService,
          vehicleModuleService,
        );

        const fitments = await vehicleModuleService.listFitments({
          part_id: partId,
          vehicle_id: vehicleId,
        });
        expect(fitments).toHaveLength(1);
        expect(fitments[0]).toMatchObject({
          source: 'auto:stub',
          status: 'active',
          steering: row.steering,
          gearbox: row.gearbox,
        });
      });

      it('never touches a manual row, even with conflicting feed data', async () => {
        const row = buildRow('manual-conflict');
        const { partId, vehicleId } = await seedPosition(row, 'manual');
        await vehicleModuleService.createFitments({
          part_id: partId,
          vehicle_id: vehicleId,
          steering: 'right',
          source: 'manual',
          status: 'active',
        });

        await runFitmentSync(
          createStubFitmentFeed([row]),
          partModuleService,
          vehicleModuleService,
        );

        const fitments = await vehicleModuleService.listFitments({
          part_id: partId,
          vehicle_id: vehicleId,
        });
        expect(fitments).toHaveLength(1);
        expect(fitments[0]).toMatchObject({
          source: 'manual',
          status: 'active',
          steering: 'right',
        });
      });

      it('never recreates a row it previously supplied that staff rejected', async () => {
        const row = buildRow('rejected');
        const { partId, vehicleId } = await seedPosition(row, 'rejected');
        await vehicleModuleService.createFitments({
          part_id: partId,
          vehicle_id: vehicleId,
          source: 'auto:stub',
          status: 'rejected',
        });

        await runFitmentSync(
          createStubFitmentFeed([row]),
          partModuleService,
          vehicleModuleService,
        );

        const fitments = await vehicleModuleService.listFitments({
          part_id: partId,
          vehicle_id: vehicleId,
        });
        expect(fitments).toHaveLength(1);
        expect(fitments[0]).toMatchObject({
          source: 'auto:stub',
          status: 'rejected',
        });
      });

      it('is idempotent across two runs: no duplicates, manual and rejected rows undisturbed', async () => {
        const freshRow = buildRow('idempotent-new');
        const manualRow = buildRow('idempotent-manual');
        const rejectedRow = buildRow('idempotent-rejected');

        const fresh = await seedPosition(freshRow, 'idempotent-new');

        const manual = await seedPosition(manualRow, 'idempotent-manual');
        await vehicleModuleService.createFitments({
          part_id: manual.partId,
          vehicle_id: manual.vehicleId,
          steering: 'right',
          source: 'manual',
          status: 'active',
        });

        const rejected = await seedPosition(rejectedRow, 'idempotent-rejected');
        await vehicleModuleService.createFitments({
          part_id: rejected.partId,
          vehicle_id: rejected.vehicleId,
          source: 'auto:stub',
          status: 'rejected',
        });

        const feed = createStubFitmentFeed([freshRow, manualRow, rejectedRow]);

        await runFitmentSync(feed, partModuleService, vehicleModuleService);
        await runFitmentSync(feed, partModuleService, vehicleModuleService);

        const freshFitments = await vehicleModuleService.listFitments({
          part_id: fresh.partId,
          vehicle_id: fresh.vehicleId,
        });
        expect(freshFitments).toHaveLength(1);
        expect(freshFitments[0]).toMatchObject({
          source: 'auto:stub',
          status: 'active',
        });

        const manualFitments = await vehicleModuleService.listFitments({
          part_id: manual.partId,
          vehicle_id: manual.vehicleId,
        });
        expect(manualFitments).toHaveLength(1);
        expect(manualFitments[0]).toMatchObject({
          source: 'manual',
          status: 'active',
          steering: 'right',
        });

        const rejectedFitments = await vehicleModuleService.listFitments({
          part_id: rejected.partId,
          vehicle_id: rejected.vehicleId,
        });
        expect(rejectedFitments).toHaveLength(1);
        expect(rejectedFitments[0]).toMatchObject({
          source: 'auto:stub',
          status: 'rejected',
        });
      });

      it('keeps two incoming rows for one Part+Vehicle position as separate active rows when they only differ by steering', async () => {
        const leftRow = buildRow('ambiguous-steering');
        const rightRow: IncomingFitment = {
          ...leftRow,
          steering: 'right',
        };
        leftRow.steering = 'left';

        const { partId, vehicleId } = await seedPosition(
          leftRow,
          'ambiguous-steering',
        );

        await runFitmentSync(
          createStubFitmentFeed([leftRow, rightRow]),
          partModuleService,
          vehicleModuleService,
        );

        const fitments = await vehicleModuleService.listFitments({
          part_id: partId,
          vehicle_id: vehicleId,
        });
        expect(fitments).toHaveLength(2);
        expect(fitments).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              source: 'auto:stub',
              status: 'active',
              steering: 'left',
            }),
            expect.objectContaining({
              source: 'auto:stub',
              status: 'active',
              steering: 'right',
            }),
          ]),
        );
      });
    });
  },
});
