# The lead form asks only for a contact; messenger taps route through it

On all three sites only the contact is required: `@podbor/lead-crm` accepts an empty `name`, and the service picker was removed from the brand forms. A shorter form converts better, and a lead is answerable without a name. A tap on a messenger tile opens the lead form with the channel preselected instead of leaving the site, because a bare click reaches the operator as a lead with no name and no contact — unanswerable. The footer and the `/thanks/` page keep direct messenger links.

## Consequences

- A service is known only where the page posts one in a hidden `SERVICE_FIELD` (service pages, CarLab's cart, Details' work pages) or where the modal trigger names one (`data-lead-service`, reset via `data-default-service`). Elsewhere the card shows `—` plus the visited page, and the bot cannot set it later. If per-service numbers ever matter more than form length, thread the page's service into the modal; do not bring the picker back.
- The form renders two or three times per page, so controls nest their label instead of using `id`/`for`.
