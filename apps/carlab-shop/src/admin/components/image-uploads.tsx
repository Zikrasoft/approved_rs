import { ArrowLeftMini, ArrowRightMini, Photo, Trash } from '@medusajs/icons';
import { Button, IconButton, Text, toast } from '@medusajs/ui';
import { useId, useRef, useState } from 'react';
import { getI18n, useTranslation } from 'react-i18next';
import { z } from 'zod';

import { adminFetch, useWriting } from '../lib/admin-fetch';
import { useConfirmed } from '../lib/confirm';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const adminImageSchema = z.object({
  id: z.string(),
  src: z.string(),
  width: z.number(),
  height: z.number(),
  srcset: z.array(z.object({ url: z.string(), width: z.number() })),
});

export type AdminImage = z.infer<typeof adminImageSchema>;

const thumbnail = (image: AdminImage) => image.srcset[0]?.url ?? image.src;

export const uploadImage = <T,>(
  path: string,
  file: File,
  schema: z.ZodType<T>,
): Promise<T | null> => {
  const t = getI18n().getFixedT(null, 'carlabAdmin');
  if (!IMAGE_TYPES.includes(file.type)) {
    toast.error(t('images.wrongType', { name: file.name }));
    return Promise.resolve(null);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast.error(t('images.tooLarge', { name: file.name }));
    return Promise.resolve(null);
  }
  return adminFetch(path, schema, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
};

export const ImageUploads = ({
  images,
  alt,
  multiple,
  onUpload,
  onDelete,
  onMove,
}: {
  images: AdminImage[];
  alt: string;
  multiple: boolean;
  onUpload: (file: File) => Promise<unknown>;
  onDelete: (image: AdminImage) => Promise<unknown>;
  onMove?: (image: AdminImage, offset: -1 | 1) => Promise<unknown>;
}) => {
  const { t } = useTranslation('carlabAdmin');
  const writing = useWriting();
  const confirmed = useConfirmed();
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [uploading, setUploading] = useState(0);

  const upload = async (files: FileList | null) => {
    const picked = [...(files ?? [])];
    setUploading(picked.length);
    for (const file of picked) {
      await onUpload(file);
      setUploading((left) => left - 1);
    }
    if (input.current) input.current.value = '';
  };

  return (
    <div className="flex flex-col gap-y-3">
      {images.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="flex w-32 flex-col gap-y-1.5 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-1.5"
            >
              <img
                src={thumbnail(image)}
                alt={alt}
                width={128}
                height={128}
                className="aspect-square w-full rounded-md bg-ui-bg-base object-contain"
              />
              <div className="flex items-center justify-between">
                {onMove && multiple ? (
                  <div className="flex">
                    <IconButton
                      size="small"
                      variant="transparent"
                      aria-label={t('images.moveLeft')}
                      disabled={index === 0 || writing}
                      onClick={() => onMove(image, -1)}
                    >
                      <ArrowLeftMini />
                    </IconButton>
                    <IconButton
                      size="small"
                      variant="transparent"
                      aria-label={t('images.moveRight')}
                      disabled={index === images.length - 1 || writing}
                      onClick={() => onMove(image, 1)}
                    >
                      <ArrowRightMini />
                    </IconButton>
                  </div>
                ) : (
                  <span />
                )}
                <IconButton
                  size="small"
                  variant="transparent"
                  aria-label={t('images.delete')}
                  disabled={writing}
                  onClick={() =>
                    confirmed({
                      title: t('images.confirmDeleteTitle'),
                      description: t('images.confirmDeleteBody'),
                      done: t('images.deleted'),
                      run: () => onDelete(image),
                    })
                  }
                >
                  <Trash />
                </IconButton>
              </div>
              {multiple && index === 0 && images.length > 1 && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {t('images.main')}
                </Text>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-x-2 text-ui-fg-subtle">
          <Photo />
          <Text size="small">{t('images.empty')}</Text>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          hidden
          multiple={multiple}
          accept={IMAGE_TYPES.join(',')}
          onChange={(event) => upload(event.target.files)}
        />
        <Button
          size="small"
          variant="secondary"
          aria-describedby={hintId}
          isLoading={uploading > 0}
          disabled={writing || uploading > 0}
          onClick={() => input.current?.click()}
        >
          {multiple || images.length === 0
            ? t('images.add')
            : t('images.replace')}
        </Button>
        <Text id={hintId} size="small" className="text-ui-fg-subtle">
          {t(multiple ? 'images.hint' : 'images.hintSingle')}
        </Text>
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        {t('images.altPreview', { alt })}
      </Text>
    </div>
  );
};
