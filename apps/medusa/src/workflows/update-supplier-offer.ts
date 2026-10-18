import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules } from '@medusajs/framework/utils';

import { PART_MODULE } from '../modules/part';
import type PartModuleService from '../modules/part/service';
import { PART_CHANGED_EVENT } from '../search/part-changed-event';

export type UpdateSupplierOfferWorkflowInput = {
  id: string;
  cost_price?: number;
  stock_quantity?: number;
  lead_time?: string;
  supplier_id?: string;
  supplier_article_id?: string;
};

const updateSupplierOfferStep = createStep(
  'update-supplier-offer',
  async (input: UpdateSupplierOfferWorkflowInput, { container }) => {
    const partModuleService: PartModuleService = container.resolve(PART_MODULE);

    const previous = await partModuleService.retrieveSupplierOffer(input.id);
    const updated = await partModuleService.updateSupplierOffers(input);

    return new StepResponse(updated, previous);
  },
  async (previous, { container }) => {
    if (!previous) {
      return;
    }

    const partModuleService: PartModuleService = container.resolve(PART_MODULE);
    await partModuleService.updateSupplierOffers({
      id: previous.id,
      cost_price: previous.cost_price,
      stock_quantity: previous.stock_quantity,
      lead_time: previous.lead_time,
      supplier_id: previous.supplier.id,
      supplier_article_id: previous.supplier_article_id,
    });
  },
);

const emitPartChangedStep = createStep(
  'emit-part-changed-for-supplier-offer',
  async (identifierId: string, { container }) => {
    const partModuleService: PartModuleService = container.resolve(PART_MODULE);
    const identifier =
      await partModuleService.retrievePartIdentifier(identifierId);

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
    emitPartChangedStep(offer.identifier_id);

    return new WorkflowResponse(offer);
  },
);
