import { z } from 'zod';
import {
  BODY_STYLES,
  ENGINE_FUELS,
  FITMENT_AXLES,
  FITMENT_SIDES,
  GEARBOX_TYPES,
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
        invalid: z.string(),
        unresolved: z.string(),
        chooseMake: z.string(),
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
        confirmVariantLead: z.string(),
        confirmVariant: z.string(),
        otherParts: z.string(),
        notYourCar: z.string(),
        vinSteering: z.string(),
        kitHeading: z.string(),
        kitLead: z.string(),
        kitAdd: z.string(),
        kitCart: z.string(),
        matchesHeading: z.string(),
        matchesLead: z.string(),
        fuel: labels(ENGINE_FUELS),
        drive: labels(VEHICLE_DRIVES),
        body: labels(BODY_STYLES),
        steering: labels(STEERING_SIDES),
      })
      .strict(),
    fitment: z
      .object({
        quantity: z.string(),
        axle: labels(FITMENT_AXLES),
        side: labels(FITMENT_SIDES),
        gearbox: labels(GEARBOX_TYPES),
        steering: z.string(),
        builtFrom: z.string(),
        builtTo: z.string(),
        partFitsHeading: z.string(),
        modelLink: z.string().includes('{model}'),
        variants: z.string().includes('{count}'),
      })
      .strict(),
    hubs: z
      .object({
        indexHeading: z.string(),
        allMakesLink: z.string(),
        makes: z
          .object({
            metaTitle: z.string(),
            metaDescription: z.string(),
            heading: z.string(),
            lead: z.string(),
            lettersLabel: z.string(),
          })
          .strict(),
        make: z
          .object({
            metaTitle: z.string(),
            metaDescription: z.string(),
            eyebrow: z.string(),
            lead: z.string(),
            modelsHeading: z.string(),
          })
          .strict(),
        model: z
          .object({
            metaTitle: z.string(),
            metaDescription: z.string(),
            eyebrow: z.string(),
            categoriesHeading: z.string(),
            noCategories: z.string(),
            carsHeading: z.string(),
            carsLead: z.string(),
          })
          .strict(),
        modelCategory: z
          .object({
            metaTitle: z.string(),
            metaDescription: z.string(),
            eyebrow: z.string(),
            partsHeading: z.string(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type PartsCarContent = z.infer<typeof partsCarContentSchema>;
