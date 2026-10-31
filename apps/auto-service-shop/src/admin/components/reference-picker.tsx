import { Button, Input, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { adminFetch } from '../lib/admin-fetch';
import type { ReferenceRow } from '../lib/vehicle-label';

export const PICKER_LIMIT = 20;

const rowSchema = z.object({ id: z.string() }).loose();

export const listingSchema = (collection: string) =>
  z
    .record(z.string(), z.unknown())
    .transform((data) => ({ rows: data[collection], count: data.count }))
    .pipe(z.object({ rows: z.array(rowSchema), count: z.number() }));

export const ReferencePicker = ({
  id,
  name,
  path,
  collection,
  label,
  optionLabel,
  onChange,
  onClear,
  exclude,
}: {
  id?: string;
  name?: string;
  path: string;
  collection: string;
  label: string;
  optionLabel: (row: ReferenceRow) => string;
  onChange: (id: string, label: string) => void;
  onClear?: () => void;
  exclude?: string;
}) => {
  const { t } = useTranslation('carlabAdmin');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<ReferenceRow[] | null>(null);

  useEffect(() => {
    const typed = query.trim();
    if (!typed) {
      setOptions(null);
      return;
    }
    const timer = setTimeout(() => {
      const search = new URLSearchParams({
        q: typed,
        limit: String(PICKER_LIMIT),
      });
      adminFetch(`/admin/${path}?${search}`, listingSchema(collection)).then(
        (data) => data && setOptions(data.rows),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [query, path, collection]);

  const shown = (options ?? []).filter((row) => row.id !== exclude);

  return (
    <div className="flex flex-col gap-y-2">
      {label && (
        <div className="flex items-center justify-between gap-x-2">
          <Text size="small" weight="plus" className="min-w-0 break-words">
            {label}
          </Text>
          {onClear && (
            <Button
              type="button"
              size="small"
              variant="transparent"
              onClick={onClear}
            >
              {t('vehicles.pickerClear')}
            </Button>
          )}
        </div>
      )}
      <Input
        id={id}
        aria-label={name}
        type="search"
        placeholder={t('vehicles.pickerPlaceholder')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {options &&
        (shown.length ? (
          <ul className="flex max-h-64 flex-col gap-y-1 overflow-y-auto">
            {shown.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="hover:bg-ui-bg-base-hover txt-small w-full rounded-md px-2 py-1.5 text-left break-words"
                  onClick={() => {
                    onChange(row.id, optionLabel(row));
                    setQuery('');
                  }}
                >
                  {optionLabel(row)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            {t('vehicles.pickerEmpty')}
          </Text>
        ))}
    </div>
  );
};
