import {
  smallestImage,
  type Image,
  type PartPage,
} from '@podbor/catalog-contract';

const SUPPLIER_IMAGE_SIZE = 800;

export type GalleryImage = {
  src: string;
  srcset: string | undefined;
  width: number;
  height: number;
  thumb: string;
};

type Pictured = {
  images: Image[];
  supplier_data: Pick<PartPage['supplier_data'], 'images'>;
};

export const partGallery = ({
  images,
  supplier_data,
}: Pictured): GalleryImage[] => [
  ...images.map((image) => ({
    src: image.src,
    srcset: image.srcset.map(({ url, width }) => `${url} ${width}w`).join(', '),
    width: image.width,
    height: image.height,
    thumb: smallestImage(image),
  })),
  ...supplier_data.images.map((url) => ({
    src: url,
    srcset: undefined,
    width: SUPPLIER_IMAGE_SIZE,
    height: SUPPLIER_IMAGE_SIZE,
    thumb: url,
  })),
];

type Illustrated = { image: Image | null } | null;

export type PartPicture = { images: GalleryImage[]; illustration: boolean };

export type Thumbnail = { src: string; illustration: boolean };

export const partPicture = (
  page: Pictured,
  category: Illustrated,
): PartPicture | null => {
  const images = partGallery(page);
  if (images.length > 0) return { images, illustration: false };
  return category?.image
    ? {
        images: partGallery({
          images: [category.image],
          supplier_data: { images: [] },
        }),
        illustration: true,
      }
    : null;
};

const thumbnailOf = (picture: PartPicture | null): Thumbnail | null =>
  picture
    ? { src: picture.images[0].thumb, illustration: picture.illustration }
    : null;

export const partThumbnail = (
  page: Pictured,
  category: Illustrated,
): Thumbnail | null => thumbnailOf(partPicture(page, category));

export const pagesThumbnail = (
  pages: (Pictured & { category: Illustrated })[],
): Thumbnail | null =>
  thumbnailOf(
    pages
      .map((page) => partPicture(page, null))
      .find((picture) => picture !== null) ??
      partPicture(
        { images: [], supplier_data: { images: [] } },
        pages[0]?.category ?? null,
      ),
  );

export const imageAlt = (brand: string, value: string, name: string) =>
  `${brand} ${value}, ${name}`;
