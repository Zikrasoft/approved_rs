import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';

const MAKES = {
  volkswagen: { slug: 'volkswagen', name: 'Volkswagen' },
  audi: { slug: 'audi', name: 'Audi' },
  skoda: { slug: 'skoda', name: 'Skoda' },
  seat: { slug: 'seat', name: 'SEAT' },
  cupra: { slug: 'cupra', name: 'Cupra' },
};

type Crawled = {
  make: keyof typeof MAKES;
  modelSlug: string;
  modelName?: string;
  chassisCode: string;
  years: [number | null, number | null];
  engineCode?: string;
};

medusaIntegrationTestRunner({
  moduleName: 'vin_lookup_vag',
  testSuite: ({ api, getContainer }) => {
    describe('VAG VIN lookup through the model code', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;
      let vinLookups: VinLookupModuleService;

      const lookUp = (vin: string) =>
        api.post('/store/vin-lookups', { vin }, storeHeaders);

      const createCrawledVehicle = ({
        make,
        modelSlug,
        modelName = '2.0 TDI 16V',
        chassisCode,
        years,
        engineCode = `E-${modelSlug}`,
      }: Crawled) =>
        createVehicleFixture(catalog, {
          make: MAKES[make],
          identifierType: 'supplier-vehicle-id',
          steering: null,
          typeCode: `crawl:${engineCode}`,
          modelSlug,
          modelName,
          chassisCode,
          engineCode,
          engineFamily: 'EA288',
          powerKw: 110,
          years,
        });

      beforeAll(async () => {
        const apiKeyModuleService: IApiKeyModuleService =
          getContainer().resolve(Modules.API_KEY);
        const publishableKey = await apiKeyModuleService.createApiKeys({
          title: 'vag-vin-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = {
          headers: { 'x-publishable-api-key': publishableKey.token },
        };
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@vag-vin-tests.local',
          'supersecret',
        );
        catalog = getContainer().resolve(CATALOG_MODULE);
        vinLookups = getContainer().resolve(VIN_LOOKUP_MODULE);
      });

      it.each([
        [
          'a Volkswagen',
          'WVWZZZAUZHW000001',
          {
            make: 'volkswagen',
            modelSlug: 'golf-vii-crawled',
            chassisCode: '5G1/BA5',
            years: [2012, 2020],
          },
        ],
        [
          'an Audi',
          'WAUZZZ8V5FA000001',
          {
            make: 'audi',
            modelSlug: 'a3-8v-crawled',
            chassisCode: '8V1/8VK/8VM/8VS',
            years: [2012, 2020],
          },
        ],
        [
          'a Skoda',
          'TMBJR8NX1PY000001',
          {
            make: 'skoda',
            modelSlug: 'octavia-iv-crawled',
            chassisCode: 'NX3/NX5',
            years: [2019, null],
          },
        ],
        [
          'a SEAT',
          'VSSZZZ5FZGR000001',
          {
            make: 'seat',
            modelSlug: 'leon-iii-crawled',
            chassisCode: '5F1/5F5/5F8',
            years: [2012, 2020],
          },
        ],
        [
          'a Cupra',
          'VSSZZZKMZMR000001',
          {
            make: 'cupra',
            modelSlug: 'formentor-crawled',
            chassisCode: 'KM7',
            years: [2020, null],
          },
        ],
      ] as [string, string, Crawled][])(
        'resolves %s VIN to the one crawled Vehicle of its model code',
        async (_, vin, crawled) => {
          const { vehicle } = await createCrawledVehicle(crawled);

          const response = await lookUp(vin);

          expect(response.data).toEqual({
            resolved: true,
            place: null,
            facts: {},
            vehicle: expect.objectContaining({ id: vehicle.id }),
          });
          const [stored] = await vinLookups.listVinLookups({ vin });
          expect(stored).toMatchObject({
            decoder: 'vag-model-code',
            decoder_version: 1,
            make: crawled.make,
            code: vin.slice(6, 8),
            code_type: 'vag-model-code',
            vehicle_id: vehicle.id,
            raw: { wmi: vin.slice(0, 3), code: vin.slice(6, 8) },
          });
        },
      );

      it('names the Model when its several Vehicles share the model code', async () => {
        const options = {
          make: 'volkswagen',
          modelSlug: 'polo-vi-crawled',
          chassisCode: 'AW1',
          years: [2017, null],
        } satisfies Crawled;
        const first = await createCrawledVehicle({
          ...options,
          engineCode: 'DKRF',
        });
        const second = await createCrawledVehicle({
          ...options,
          engineCode: 'DKLA',
        });

        const response = await lookUp('WVWZZZAWZKU000001');

        expect(response.data).toMatchObject({
          resolved: false,
          make: 'volkswagen',
          code: 'AW',
          model_slug: 'polo-vi-crawled',
        });
        expect([...response.data.vehicle_ids].sort()).toEqual(
          [first.vehicle.id, second.vehicle.id].sort(),
        );
      });

      it('keeps the Vehicle the model year of the VIN falls in', async () => {
        const golfV = await createCrawledVehicle({
          make: 'volkswagen',
          modelSlug: 'golf-v-years',
          chassisCode: '1K1',
          years: [2003, 2008],
        });
        await createCrawledVehicle({
          make: 'volkswagen',
          modelSlug: 'golf-vi-years',
          chassisCode: '5K1',
          years: [2008, 2013],
        });

        const response = await lookUp('WVWZZZ1KZ5W000001');

        expect(response.data).toMatchObject({
          resolved: true,
          vehicle: { id: golfV.vehicle.id },
        });
      });

      it('leaves a VIN unresolved when no Vehicle was built in its model year', async () => {
        await createCrawledVehicle({
          make: 'skoda',
          modelSlug: 'fabia-iii-early',
          chassisCode: 'NJ3',
          years: [2014, 2015],
        });

        const response = await lookUp('TMBEJ6NJ5LZ000001');

        expect(response.data).toMatchObject({
          resolved: false,
          make: 'skoda',
          code: 'NJ',
          vehicle_ids: [],
        });
      });

      it('prefers the Vehicle staff gave the model code over the crawl match', async () => {
        await createCrawledVehicle({
          make: 'audi',
          modelSlug: 'q5-fy-crawled',
          chassisCode: 'FYB',
          years: [2016, null],
        });
        const { vehicle } = await createVehicleFixture(catalog, {
          make: MAKES.audi,
          identifierType: 'vag-model-code',
          typeCode: 'FY',
          modelSlug: 'q5-fy-staff',
          chassisCode: 'FYG',
          years: [2016, null],
        });

        const response = await lookUp('WAUZZZFY0KA000001');

        expect(response.data).toMatchObject({
          resolved: true,
          vehicle: { id: vehicle.id },
        });
      });

      it('leaves a model code without Models in the catalogue unresolved', async () => {
        const { chassis } = await createCrawledVehicle({
          make: 'volkswagen',
          modelSlug: 'passat-b5-crawled',
          chassisCode: '3B2',
          years: [1996, 2005],
        });
        await catalog.createChassis({
          series_id: chassis.series_id,
          code: 'CD1',
          body_style: 'hatchback',
        });

        const response = await lookUp('WVWZZZCDZMW000001');

        expect(response.data).toMatchObject({
          resolved: false,
          make: 'volkswagen',
          code: 'CD',
          vehicle_ids: [],
        });
      });

      it('shows staff what the open data says about an unresolved model code', async () => {
        await lookUp('WVWZZZCDZMW000002');
        await lookUp('WVWZZZ00ZKW000003');

        const { codes } = (
          await api.get('/admin/vin-lookups/unresolved', adminHeaders)
        ).data;
        const entry = (code: string) =>
          codes.find(
            (found: { make: string; code: string }) =>
              found.make === 'volkswagen' && found.code === code,
          );

        expect(entry('CD')).toMatchObject({
          reference: {
            code: 'CD',
            chassis: expect.stringContaining('CD'),
            model: expect.stringContaining('Golf VIII'),
            from: expect.any(String),
          },
        });
        expect(entry('00')).toMatchObject({ reference: null });
        const [stored] = await vinLookups.listVinLookups({
          vin: 'WVWZZZ00ZKW000003',
        });
        expect(stored).toMatchObject({
          decoder: 'vag-model-code',
          make: 'volkswagen',
          code: '00',
          code_type: 'vag-model-code',
          vehicle_id: null,
        });
      });

      it('still answers a BMW VIN through the BMW decoder first', async () => {
        await lookUp('WBA8C51070N000009');

        const [stored] = await vinLookups.listVinLookups({
          vin: 'WBA8C51070N000009',
        });
        expect(stored).toMatchObject({
          decoder: 'bmw-type-code',
          make: 'bmw',
        });
      });
    });
  },
});
