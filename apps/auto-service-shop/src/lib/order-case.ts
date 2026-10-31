import type { MedusaContainer } from '@medusajs/framework/types';
import {
  type OrderCaseSummary,
  type Vehicle,
  vehicleName,
} from '@podbor/catalog-contract';

import type { LeadOrder } from './order-lead';
import { readPlacedOrder } from './placed-order';
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
  const placed = readPlacedOrder(order);
  const parts = placed.lines
    .filter(({ addon, part }) => !addon && part.brand && part.number)
    .map(({ part: { brand, number } }) => ({ brand, number }));
  return {
    display_id: order.display_id,
    car: await carOf(container, placed.contact?.vin),
    parts: parts.filter(
      (part, index) =>
        parts.findIndex(
          ({ brand, number }) => brand === part.brand && number === part.number,
        ) === index,
    ),
    total_rsd: order.currency_code === 'rsd' ? Math.round(placed.total) : null,
  };
}
