# Lead forms and the lead modal

House style for all three sites. The form's markup hooks are in
[markup-contracts.md](markup-contracts.md).

- **The lead form carries its own `locale`** in a hidden input. Middleware never
  runs for a prerendered page on Vercel's static output, so the `lang` cookie
  may not exist — without the field, every non-Russian visitor lands on
  `/ru/thanks/` and the lead is stored as `locale: 'ru'`.
- **Only the contact is required**, on all three sites: `@podbor/lead-crm`'s
  form schema accepts an empty `name`, and no form marks it `required`. A
  shorter form converts better, and a lead is answerable without a name. The
  same reasoning removed the service picker from the brand forms. What posts a
  slug now is the page, through a hidden `SERVICE_FIELD` input: the service
  pages, CarLab's VIN-inquiry parts pages (`vin-parts-inquiry`) and Details'
  work pages (`servicesApplied[0]`). Everywhere else (the modal, the contact page, the
  homepage forms) a lead carries no service **by design**, and the owner
  card renders `—` for it with the visited page on the `Страница:` line. A
  contact click renders `Клик: <канал>` instead: the click has a channel worth
  naming, a form lead does not. The
  bot cannot set the service afterwards, so treat it as lost rather than
  pending; if per-service numbers ever matter more than the shorter form, the
  fix is to thread the page's service into the modal, not to bring the picker
  back.
- **The lead modal takes its service from the trigger.** `data-lead-service` on
  a button sets the form's `service` when the modal opens; `data-default-service`
  on the form is what it resets to when the trigger names none. The same
  opening picks the tab the trigger's `data-open-lead-modal` names, focuses
  the form's first field (unless the modal marks a `data-modal-focus` target)
  and fires `lead_modal_open`; all of it is `defineLeadModal(tagName)` from
  `@podbor/site-kit/lead-form`, which every app's lead modal is defined with,
  and the attribute constants live there too. The second attribute is not redundant:
  for an `<input type="hidden">` the `value` IDL attribute reflects the content
  attribute, so assigning `.value` moves `defaultValue` with it and the slug
  would stick between openings of the same modal.
- **Form controls nest their label** instead of using `id`/`for`. The lead form
  renders two or three times per page (inline, in the modal, on the contact
  page), and duplicate ids make every label focus the first form.
