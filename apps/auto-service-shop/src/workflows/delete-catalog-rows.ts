import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';
import { VIN_LOOKUP_MODULE } from '../modules/vin-lookup';
import type VinLookupModuleService from '../modules/vin-lookup/service';

const withSupplierId = <Row extends { supplier_id: string }>(row: Row) => ({
  ...row,
  supplier: row.supplier_id,
});

const deleteSupplierRowsStep = createStep(
  'delete-supplier-rows-of-identifiers',
  async (identifierIds: string | string[], { container }) => {
    const suppliers: SupplierModuleService = container.resolve(SUPPLIER_MODULE);
    const filter = { part_identifier_id: identifierIds };
    const offers = await suppliers.listSupplierOffers(filter, { take: null });
    const staged = await suppliers.listStagedRecords(filter, { take: null });
    if (offers.length) {
      await suppliers.deleteSupplierOffers(offers.map(({ id }) => id));
    }
    if (staged.length) {
      await suppliers.deleteStagedRecords(staged.map(({ id }) => id));
    }
    return new StepResponse(undefined, { offers, staged });
  },
  async (deleted, { container }) => {
    if (!deleted) {
      return;
    }
    const suppliers: SupplierModuleService = container.resolve(SUPPLIER_MODULE);
    if (deleted.offers.length) {
      await suppliers.createSupplierOffers(deleted.offers.map(withSupplierId));
    }
    if (deleted.staged.length) {
      await suppliers.createStagedRecords(deleted.staged.map(withSupplierId));
    }
  },
);

const deletePartStep = createStep(
  'delete-part',
  async (id: string, { container }) => {
    const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
    await catalog.deleteParts(id);
    return new StepResponse(id);
  },
);

const removePartIdentifierStep = createStep(
  'remove-part-identifier',
  async (id: string, { container }) => {
    const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
    await catalog.removePartIdentifier(id);
    return new StepResponse(id);
  },
);

const forgetVehicleInVinLookupsStep = createStep(
  'forget-vehicle-in-vin-lookups',
  async (vehicleId: string, { container }) => {
    const vinLookups: VinLookupModuleService =
      container.resolve(VIN_LOOKUP_MODULE);
    const lookups = await vinLookups.listVinLookups(
      { vehicle_id: vehicleId },
      { select: ['id'], take: null },
    );
    const ids = lookups.map(({ id }) => id);
    if (ids.length) {
      await vinLookups.updateVinLookups({
        selector: { id: ids },
        data: { vehicle_id: null },
      });
    }
    return new StepResponse(undefined, { vehicleId, ids });
  },
  async (forgotten, { container }) => {
    if (!forgotten?.ids.length) {
      return;
    }
    const vinLookups: VinLookupModuleService =
      container.resolve(VIN_LOOKUP_MODULE);
    await vinLookups.updateVinLookups({
      selector: { id: forgotten.ids },
      data: { vehicle_id: forgotten.vehicleId },
    });
  },
);

const deleteVehicleStep = createStep(
  'delete-vehicle',
  async (id: string, { container }) => {
    const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
    await catalog.deleteVehicles(id);
    return new StepResponse(id);
  },
);

export const deletePartWorkflow = createWorkflow(
  'delete-part',
  (input: { id: string; identifierIds: string[] }) => {
    deleteSupplierRowsStep(input.identifierIds);
    return new WorkflowResponse(deletePartStep(input.id));
  },
);

export const deletePartIdentifierWorkflow = createWorkflow(
  'delete-part-identifier',
  (input: { id: string }) => {
    deleteSupplierRowsStep(input.id);
    return new WorkflowResponse(removePartIdentifierStep(input.id));
  },
);

export const deleteVehicleWorkflow = createWorkflow(
  'delete-vehicle',
  (input: { id: string }) => {
    forgetVehicleInVinLookupsStep(input.id);
    return new WorkflowResponse(deleteVehicleStep(input.id));
  },
);
