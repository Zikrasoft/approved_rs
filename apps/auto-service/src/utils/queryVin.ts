import { vinOf } from '@podbor/lead-crm/vin';
import { fromRussianLayout } from './keyboardLayout';

const withoutGluedLabel = (text: string): string =>
  text.replace(/^\s*vin(?=[a-z0-9]{17}\s*$)/i, '');

export const queryVin = (q: string): string | null =>
  vinOf(withoutGluedLabel(q)) ?? vinOf(withoutGluedLabel(fromRussianLayout(q)));
