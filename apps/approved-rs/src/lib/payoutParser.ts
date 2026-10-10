import { APPROVED, CARLAB, DETAILS } from '@podbor/brands';
import {
  createPayoutParser,
  type PayoutParser,
} from '@podbor/lead-crm/payout-parser';
import { z } from 'zod';

const envSchema = z.object({
  OPENAI_API_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
});

const { OPENAI_API_KEY } = envSchema.parse(process.env);

const missingKey: PayoutParser = async () => {
  throw new Error('[payout-parser] OPENAI_API_KEY is not set');
};

export const parsePayout: PayoutParser = OPENAI_API_KEY
  ? createPayoutParser({
      apiKey: OPENAI_API_KEY,
      brands: {
        [APPROVED.name]: 'car selection, inspection and import for a buyer',
        [CARLAB.name]: 'car service, repairs and car parts',
        [DETAILS.name]:
          'detailing: polishing, ceramic coating, interior cleaning',
      },
    })
  : missingKey;
