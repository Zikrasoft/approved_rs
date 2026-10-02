export const LEAD_FORM_RESULT_EVENT = 'lead-form-result';

export interface LeadFormResult {
  ok: boolean;
}

export async function submitLeadForm(form: HTMLFormElement): Promise<boolean> {
  const response = await fetch(form.action, {
    method: 'POST',
    body: new FormData(form),
  }).catch(() => undefined);
  const ok = response?.redirected === true;
  form.dispatchEvent(
    new CustomEvent<LeadFormResult>(LEAD_FORM_RESULT_EVENT, {
      bubbles: true,
      detail: { ok },
    }),
  );
  if (response && ok) location.assign(response.url || form.action);
  return ok;
}
