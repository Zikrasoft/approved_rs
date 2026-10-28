import { Badge, Button, Input, Select, toast } from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { acknowledged, adminFetch, useWriting } from '../lib/admin-fetch';
import { useConfirmed } from '../lib/confirm';

export const spellingSchema = z.object({
  id: z.string(),
  supplier_id: z.string(),
  value: z.string(),
});

type Spelling = z.infer<typeof spellingSchema>;

export const suppliersSchema = z.object({
  suppliers: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type Supplier = z.infer<typeof suppliersSchema>['suppliers'][number];

export const Spellings = ({
  path,
  copy,
  spellings,
  suppliers,
  reload,
}: {
  path: string;
  copy: 'brands' | 'vehicles.makeSpellings';
  spellings: Spelling[];
  suppliers: Supplier[];
  reload: () => Promise<void>;
}) => {
  const writing = useWriting();
  const { t } = useTranslation('carlabAdmin');
  const confirmed = useConfirmed();
  const [supplierId, setSupplierId] = useState('');
  const [value, setValue] = useState('');

  const supplierName = (id: string) =>
    suppliers.find((supplier) => supplier.id === id)?.name ?? id;

  const add = async () => {
    const created = await adminFetch(path, acknowledged, {
      method: 'POST',
      body: JSON.stringify({ supplier_id: supplierId, value }),
    });
    if (created) {
      toast.success(t(`${copy}.spellingAdded`, { spelling: value }));
      setSupplierId('');
      setValue('');
      await reload();
    }
  };

  const remove = async (spelling: Spelling) => {
    if (
      await confirmed({
        title: t(`${copy}.confirmSpellingTitle`, { spelling: spelling.value }),
        description: t(`${copy}.confirmSpellingBody`),
        done: t(`${copy}.spellingRemoved`, { spelling: spelling.value }),
        run: () =>
          adminFetch(`${path}/${spelling.id}`, acknowledged, {
            method: 'DELETE',
          }),
      })
    ) {
      await reload();
    }
  };

  return (
    <div className="flex flex-col gap-y-2 py-2">
      <div className="flex flex-wrap gap-2">
        {spellings.map((spelling) => (
          <Badge key={spelling.id} size="small">
            {supplierName(spelling.supplier_id)}: {spelling.value}
            <button
              type="button"
              className="ml-1"
              aria-label={t(`${copy}.removeSpelling`, {
                spelling: spelling.value,
              })}
              onClick={() => remove(spelling)}
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={supplierId} onValueChange={setSupplierId}>
          <Select.Trigger>
            <Select.Value placeholder={t(`${copy}.supplierPlaceholder`)} />
          </Select.Trigger>
          <Select.Content>
            {suppliers.map((supplier) => (
              <Select.Item key={supplier.id} value={supplier.id}>
                {supplier.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <Input
          size="small"
          className="min-w-[10rem]"
          maxLength={200}
          placeholder={t(`${copy}.spellingPlaceholder`)}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          size="small"
          variant="secondary"
          onClick={add}
          disabled={!supplierId || !value || writing}
        >
          {t(`${copy}.addSpelling`)}
        </Button>
      </div>
    </div>
  );
};
