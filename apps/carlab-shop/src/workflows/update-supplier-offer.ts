import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules } from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';
import { PART_CHANGED_EVENT } from '../search/part-changed-event';

export type UpdateSupplierOfferWorkflowInput = {
  id: string;
  cost_price?: number;
  stock_quantity?: number;
  lead_time_days?: number;
  supplier_id?: string;
  supplier_article_id?: string;
};

const updateSupplierOfferStep = createStep(
  'update-supplier-offer',
  async (input: UpdateSupplierOfferWorkflowInput, { container }) => {
    const supplierService: SupplierModuleService =
      container.resolve(SUPPLIER_MODULE);

    const previous = await supplierService.retrieveSupplierOffer(input.id);
    const updated = await supplierService.updateSupplierOffers(input);

    return new StepResponse(updated, previous);
  },
  async (previous, { container }) => {
    if (!previous) {
      return;
    }

    const supplierService: SupplierModuleService =
      container.resolve(SUPPLIER_MODULE);
    await supplierService.updateSupplierOffers({
      id: previous.id,
      cost_price: previous.cost_price,
      stock_quantity: previous.stock_quantity,
      lead_time_days: previous.lead_time_days,
      supplier_id: previous.supplier_id,
      supplier_article_id: previous.supplier_article_id,
    });
  },
);

const emitPartChangedStep = createStep(
  'emit-part-changed-for-supplier-offer',
  async (partIdentifierId: string, { container }) => {
    const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
    const identifier = await catalog.retrievePartIdentifier(partIdentifierId);

    const eventBus = container.resolve(Modules.EVENT_BUS);
    await eventBus.emit({
      name: PART_CHANGED_EVENT,
      data: { part_id: identifier.part_id },
    });

    return new StepResponse(identifier.part_id);
  },
);

export const updateSupplierOfferWorkflow = createWorkflow(
  'update-supplier-offer',
  (input: UpdateSupplierOfferWorkflowInput) => {
    const offer = updateSupplierOfferStep(input);
    emitPartChangedStep(offer.part_identifier_id);

    return new WorkflowResponse(offer);
  },
);
