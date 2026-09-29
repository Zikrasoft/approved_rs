---
status: proposed
---

# Order emails go through Brevo via a small custom provider

Implemented on branch `feat/carlab-shop`.

Medusa 2.19 ships only `notification-local` and `notification-sendgrid`. Brevo was chosen: a free tier (300/day) far above ~500 emails/month, an EU company with EU hosting, DKIM without a separate SPF record, and Serbia outside its export-control list. `modules/notification-brevo` is one `POST /v3/smtp/email`, registered only when `BREVO_API_KEY` and `BREVO_FROM_EMAIL` are set; otherwise `notification-local` runs and production logs a warning, since customers would get no email.

## Considered Options

- **SendGrid** (official module): no free plan any more, US-only processing.
- **Resend, Postmark**: US processors; Postmark's free tier is below the need.
- **SMTP.BZ** (staywildwear's provider): Russian; only its module shape was reused.
