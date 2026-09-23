export const INVALID_ATTRIBUTE = 'aria-invalid';
export const FIELD_NAME_ATTRIBUTE = 'data-field';

export function markFieldValidity(control: Element, valid: boolean): void {
  if (valid) control.removeAttribute(INVALID_ATTRIBUTE);
  else control.setAttribute(INVALID_ATTRIBUTE, 'true');
}
