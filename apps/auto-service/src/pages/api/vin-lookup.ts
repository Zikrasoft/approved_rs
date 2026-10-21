export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { PRIMARY_LOCALE, SUPPORTED_LOCALES } from '@/i18n/config';
import { carFactsQuery } from '@/utils/carFacts';
import { catalogueFromEnv, siteEnv } from '@/utils/catalogue';
import { PathBuilder } from '@/utils/paths';

const formSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES).catch(PRIMARY_LOCALE),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/)
    .nullable()
    .catch(null),
});

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const { locale, vin } = formSchema.parse({
    locale: form.get('locale'),
    vin: form.get('vin'),
  });
  const outcome = vin
    ? await catalogueFromEnv(siteEnv())?.resolveVin(vin)
    : null;
  return redirect(
    outcome?.kind === 'vehicle'
      ? `${PathBuilder.partsCar(locale, outcome.vehicle.id)}${carFactsQuery(outcome.facts)}`
      : PathBuilder.partsVinUnresolved(locale),
    303,
  );
};
