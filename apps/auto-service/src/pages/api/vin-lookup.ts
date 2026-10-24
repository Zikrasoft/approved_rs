export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { vinSchema } from '@podbor/catalog-contract';
import { localeFieldSchema } from '@/i18n/localeField';
import { carFactsQuery } from '@/utils/carFacts';
import { catalogueFromEnv, siteEnv } from '@/utils/catalogue';
import { PathBuilder } from '@/utils/paths';

const formSchema = z.object({
  locale: localeFieldSchema,
  vin: vinSchema.nullable().catch(null),
});

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData().catch(() => new FormData());
  const { locale, vin } = formSchema.parse({
    locale: form.get('locale'),
    vin: form.get('vin'),
  });
  const outcome = vin
    ? await catalogueFromEnv(siteEnv())?.resolveVin(vin)
    : null;
  return redirect(
    outcome?.kind === 'vehicle'
      ? `${PathBuilder.partsCar(locale, outcome.vehicle.id)}${carFactsQuery(outcome.facts, vin ?? '')}`
      : PathBuilder.partsVinUnresolved(locale),
    303,
  );
};
