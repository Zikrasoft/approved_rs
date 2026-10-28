import type { MedusaRequest } from '@medusajs/framework/http';
import type {
  IFileModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import {
  generateEntityId,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils';
import { imageSchema } from '@podbor/catalog-contract';
import sharp from 'sharp';
import { z } from 'zod';

import { adminError } from './admin-errors';
import { readUpload, uploadType } from './uploads';
import { MANUAL_SOURCE } from '../modules/catalog/models/provenance';
import type CatalogModuleService from '../modules/catalog/service';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_WIDTHS = [160, 480, 960];

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const storedImageSchema = imageSchema.extend({
  id: z.string(),
  file_ids: z.array(z.string()),
  source: z.string(),
  created_by: z.string().nullable(),
});

export type StoredImage = z.infer<typeof storedImageSchema>;

export const imagesSchema = z.object({ items: z.array(storedImageSchema) });

export const adminImage = ({ file_ids: _, ...image }: StoredImage) => image;

const invalidImage = (message: string) =>
  adminError(MedusaError.Types.INVALID_DATA, 'INVALID_IMAGE', message);

export async function readImageUpload(req: MedusaRequest): Promise<Buffer> {
  const type = uploadType(req);
  if (!IMAGE_TYPES[type]) {
    throw invalidImage(`Unsupported image type ${type || 'none'}`);
  }
  const body = await readUpload(req, MAX_IMAGE_BYTES, () =>
    adminError(
      MedusaError.Types.INVALID_DATA,
      'IMAGE_TOO_LARGE',
      `Images are limited to ${MAX_IMAGE_BYTES} bytes`,
    ),
  );
  const format = await sharp(body)
    .metadata()
    .then((metadata) => metadata.format)
    .catch(() => null);
  if (format !== IMAGE_TYPES[type]) {
    throw invalidImage(`The file is not a ${IMAGE_TYPES[type]} image`);
  }
  return body;
}

export async function storeImage(
  scope: MedusaContainer,
  body: Buffer,
  name: string,
  actor: string | null,
): Promise<StoredImage> {
  const files: IFileModuleService = scope.resolve(Modules.FILE);
  const resized = await Promise.all(
    IMAGE_WIDTHS.map((width) =>
      sharp(body)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true }),
    ),
  );
  const variants = await Promise.all(
    resized
      .filter(
        ({ info }, index) =>
          resized.findIndex((other) => other.info.width === info.width) ===
          index,
      )
      .map(async ({ data, info }) => ({
        info,
        file: await files.createFiles({
          filename: `${name}-${info.width}.webp`,
          mimeType: 'image/webp',
          content: data.toString('base64'),
          access: 'public',
        }),
      })),
  );
  const largest = variants[variants.length - 1];
  return {
    id: generateEntityId(undefined, 'img'),
    src: largest.file.url,
    width: largest.info.width,
    height: largest.info.height,
    srcset: variants.map(({ file, info }) => ({
      url: file.url,
      width: info.width,
    })),
    file_ids: variants.map(({ file }) => file.id),
    source: MANUAL_SOURCE,
    created_by: actor,
  };
}

export async function deleteImageFiles(
  scope: MedusaContainer,
  images: StoredImage[],
): Promise<void> {
  const ids = images.flatMap(({ file_ids }) => file_ids);
  if (ids.length) {
    const files: IFileModuleService = scope.resolve(Modules.FILE);
    await files.deleteFiles(ids);
  }
}

export async function readIdentifierImages(
  catalog: CatalogModuleService,
  identifierId: string,
): Promise<StoredImage[]> {
  const identifier = await catalog.retrievePartIdentifier(identifierId);
  return imagesSchema.parse(identifier.images).items;
}

export async function writeIdentifierImages(
  catalog: CatalogModuleService,
  identifierId: string,
  items: StoredImage[],
  updated_by: string | null,
) {
  await catalog.updatePartIdentifiers({
    id: identifierId,
    images: { items },
    updated_by,
  });
  return { images: items.map(adminImage) };
}
