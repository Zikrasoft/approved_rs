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

const categoryThumbnail = (category: Illustrated) =>
  category?.image ? smallestImage(category.image) : null;

export const partThumbnail = (
  page: Pictured,
  category: Illustrated,
): string | null => partGallery(page)[0]?.thumb ?? categoryThumbnail(category);

export const pagesThumbnail = (
  pages: (Pictured & { category: Illustrated })[],
): string | null =>
  pages.map((page) => partGallery(page)[0]?.thumb).find(Boolean) ??
  categoryThumbnail(pages[0]?.category ?? null);

export const imageAlt = (brand: string, value: string, name: string) =>
  `${brand} ${value}, ${name}`;
