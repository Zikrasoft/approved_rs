import { APPROVED, CARLAB, DETAILS } from '@podbor/brands';
import {
  createPayoutParser,
  type PayoutParser,
} from '@podbor/lead-crm/payout-parser';
import {
  createTranscriber,
  type Transcriber,
} from '@podbor/lead-crm/transcriber';
import { z } from 'zod';

const envSchema = z.object({
  OPENAI_API_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
});

const { OPENAI_API_KEY } = envSchema.parse(process.env);

const missingKey = async (): Promise<never> => {
  throw new Error('[payout-parser] OPENAI_API_KEY is not set');
};

export const parsePayout: PayoutParser = OPENAI_API_KEY
  ? createPayoutParser({
      apiKey: OPENAI_API_KEY,
      brands: Object.fromEntries(
        [APPROVED, CARLAB, DETAILS].map((b) => [b.name, b.lineOfWork]),
      ),
    })
  : missingKey;

export const transcribeVoice: Transcriber = OPENAI_API_KEY
  ? createTranscriber({ apiKey: OPENAI_API_KEY })
  : missingKey;
