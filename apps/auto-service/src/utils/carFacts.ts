import { vinOf } from '@podbor/lead-crm/vin';

export const VIN_PARAM = 'vin';

export const vinFrom = (search: string): string =>
  vinOf(new URLSearchParams(search).get(VIN_PARAM) ?? '') ?? '';
