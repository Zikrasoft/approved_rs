import { z } from 'zod';
import {
  BODY_STYLES,
  ENGINE_FUELS,
  STEERING_SIDES,
  VEHICLE_DRIVES,
} from '@podbor/catalog-contract';

const labels = <T extends readonly [string, ...string[]]>(keys: T) =>
  z
    .object(
      Object.fromEntries(keys.map((key) => [key, z.string()])) as Record<
        T[number],
        z.ZodString
      >,
    )
    .strict();

export const partsCarContentSchema = z
  .object({
    vin: z
      .object({
        heading: z.string(),
        lead: z.string(),
        label: z.string(),
        placeholder: z.string(),
        submitLabel: z.string(),
        unresolved: z.string(),
      })
      .strict(),
    car: z
      .object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        eyebrow: z.string(),
        specsHeading: z.string(),
        engineLabel: z.string(),
        fuelLabel: z.string(),
        displacementLabel: z.string(),
        powerLabel: z.string(),
        driveLabel: z.string(),
        bodyLabel: z.string(),
        yearsLabel: z.string(),
        steeringLabel: z.string(),
        typeCodeLabel: z.string(),
        displacementUnit: z.string(),
        powerUnit: z.string(),
        yearsOngoing: z.string(),
        partsHeading: z.string(),
        partsLead: z.string(),
        formHeading: z.string(),
        notYourCar: z.string(),
        fuel: labels(ENGINE_FUELS),
        drive: labels(VEHICLE_DRIVES),
        body: labels(BODY_STYLES),
        steering: labels(STEERING_SIDES),
      })
      .strict(),
  })
  .strict();

export type PartsCarContent = z.infer<typeof partsCarContentSchema>;
