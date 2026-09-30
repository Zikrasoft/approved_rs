import { phoneKit } from '@podbor/lead-crm/phone-kit';

export function phoneInvalid(typed: string, value: string): boolean {
  if (typed.trim() === '') return true;
  const kit = phoneKit();
  return kit
    ? !kit.isValidContact(value, 'phone')
    : !/^\+\d{8,15}$/.test(value);
}
