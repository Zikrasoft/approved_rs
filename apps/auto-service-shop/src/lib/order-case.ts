import type { MedusaContainer } from '@medusajs/framework/types';
import {
  checkoutContactSchema,
  type OrderCaseSummary,
  type Vehicle,
  vehicleName,
} from '@podbor/catalog-contract';

import { listedPartOf, orderTotal, readLine } from './line-metadata';
import type { LeadOrder } from './order-lead';
import { vehicleForVin } from './vin/car-for';

const VIN_YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';
const VIN_YEAR_CYCLES = [1980, 2010, 2040];

const modelYear = (vin: string, { year_from, year_to }: Vehicle) => {
  const code = VIN_YEAR_CODES.indexOf(vin.charAt(9));
  if (code < 0 || year_from === null) return null;
  return (
    VIN_YEAR_CYCLES.map((cycle) => cycle + code).find(
      (year) => year >= year_from && year <= (year_to ?? year),
    ) ?? null
  );
};

async function carOf(
  container: MedusaContainer,
  vin: string | undefined,
): Promise<OrderCaseSummary['car']> {
  const vehicle = vin ? await vehicleForVin(container, vin) : null;
  if (!vin || !vehicle) return null;
  const { make, model } = vehicleName(vehicle.model);
  return { make, model, year: modelYear(vin, vehicle) };
}

export async function orderCaseSummary(
  container: MedusaContainer,
  order: LeadOrder,
): Promise<OrderCaseSummary> {
  const contact = checkoutContactSchema.safeParse(order.metadata ?? {});
  const parts = order.items
    .filter((item) => !readLine(item.metadata).addonKind)
    .map(({ metadata, title }) => listedPartOf(metadata, title))
    .filter(({ brand, number }) => brand && number)
    .map(({ brand, number }) => ({ brand, number }));
  const total = orderTotal(order.items);
  return {
    display_id: order.display_id,
    car: await carOf(container, contact.data?.vin),
    parts: parts.filter(
      (part, index) =>
        parts.findIndex(
          ({ brand, number }) => brand === part.brand && number === part.number,
        ) === index,
    ),
    total_rsd: order.currency_code === 'rsd' ? Math.round(total) : null,
  };
}
