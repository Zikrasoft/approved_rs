import {
  Badge,
  Button,
  clx,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  toast,
} from '@medusajs/ui';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  acknowledged,
  adminFetch,
  editedBySchema,
  useWriting,
} from '../lib/admin-fetch';
import { useConfirmed } from '../lib/confirm';
import { DrawerHeader } from './dialog-header';
import { EditedBy } from './edited-by';

const FIELDS = ['cost_price', 'stock_quantity', 'lead_time_days'] as const;

type Field = (typeof FIELDS)[number];
type Draft = Record<Field, string>;

const EMPTY: Draft = { cost_price: '', stock_quantity: '', lead_time_days: '' };

const INPUT_LIMITS: Record<Field, { min: number; max: number; step: number }> =
  {
    cost_price: { min: 0.01, max: 10_000_000, step: 0.01 },
    stock_quantity: { min: 0, max: 100_000, step: 1 },
    lead_time_days: { min: 0, max: 365, step: 1 },
  };

const offersSchema = z.object({
  offers: z.array(
    editedBySchema.extend({
      id: z.string(),
      source: z.string(),
      manual: z.boolean(),
      cost_price: z.number(),
      price: z.number(),
      currency: z.string(),
      stock_quantity: z.number(),
      lead_time_days: z.number(),
    }),
  ),
});

type Offer = z.infer<typeof offersSchema>['offers'][number];

export type OffersTarget = { id: string; number: string };

const draftOf = (offer: Offer | undefined): Draft =>
  offer
    ? {
        cost_price: String(offer.cost_price),
        stock_quantity: String(offer.stock_quantity),
        lead_time_days: String(offer.lead_time_days),
      }
    : EMPTY;

const fieldOf = (path: string): Field =>
  FIELDS.find((field) => path.endsWith(field)) ?? 'lead_time_days';

export const OffersDrawer = ({
  target,
  onClose,
  onChanged,
}: {
  target: OffersTarget | null;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const writing = useWriting();
  const confirmed = useConfirmed();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const manual = offers?.find((offer) => offer.manual);
  const basePath = target && `/admin/part-identifiers/${target.id}`;

  const load = async () => {
    if (!basePath) return;
    const data = await adminFetch(`${basePath}/offers`, offersSchema);
    setOffers(data?.offers ?? []);
    setDraft(draftOf(data?.offers.find((offer) => offer.manual)));
    setErrors({});
  };

  useEffect(() => {
    setOffers(null);
    load();
  }, [basePath]);

  const money = (value: number, currency: string) =>
    `${value.toLocaleString(i18n.language)} ${currency}`;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!basePath) return;
    setErrors({});
    setSaving(true);
    const body = Object.fromEntries(
      FIELDS.map((field) => [
        field,
        draft[field].trim() === '' ? null : Number(draft[field]),
      ]),
    );
    const saved = await adminFetch(
      `${basePath}/manual-offer`,
      acknowledged,
      { method: 'POST', body: JSON.stringify(body) },
      (path, message) =>
        setErrors((current) => ({ ...current, [fieldOf(path)]: message })),
    );
    setSaving(false);
    if (saved) {
      toast.success(t('offers.saved'));
      await load();
      onChanged();
    }
  };

  const remove = () =>
    basePath &&
    confirmed({
      title: t('offers.confirmTitle'),
      description: t('offers.confirmBody', { number: target?.number ?? '' }),
      done: t('offers.deleted'),
      run: async () => {
        const deleted = await adminFetch(
          `${basePath}/manual-offer`,
          acknowledged,
          {
            method: 'DELETE',
          },
        );
        if (deleted) {
          await load();
          onChanged();
        }
        return deleted;
      },
    });

  return (
    <Drawer open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <DrawerHeader>
          <Drawer.Title asChild>
            <Heading>
              {t('offers.heading', { number: target?.number ?? '' })}
            </Heading>
          </Drawer.Title>
          <Drawer.Description className="txt-small text-ui-fg-subtle">
            {t('offers.lead')}
          </Drawer.Description>
        </DrawerHeader>
        <Drawer.Body className="flex flex-col gap-y-8 overflow-y-auto">
          {offers &&
            (offers.length ? (
              <ul className="divide-ui-border-base border-ui-border-base flex flex-col divide-y rounded-lg border">
                {offers.map((offer) => (
                  <li key={offer.id} className="flex flex-col gap-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {offer.manual ? (
                        <Badge size="2xsmall" color="blue">
                          {t('sources.names.manual')}
                        </Badge>
                      ) : (
                        <Text size="small" weight="plus">
                          {offer.source}
                        </Text>
                      )}
                      <EditedBy row={offer} className="whitespace-normal" />
                    </div>
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {(
                        [
                          ['cost', money(offer.cost_price, offer.currency)],
                          ['price', money(offer.price, offer.currency)],
                          ['stock', String(offer.stock_quantity)],
                          [
                            'leadTime',
                            t('offers.days', { count: offer.lead_time_days }),
                          ],
                        ] as const
                      ).map(([column, value]) => (
                        <div key={column} className="flex flex-col gap-y-0.5">
                          <dt className="txt-compact-xsmall text-ui-fg-subtle">
                            {t(`offers.columns.${column}`)}
                          </dt>
                          <dd
                            className={clx(
                              'txt-compact-small tabular-nums',
                              column === 'price' && 'txt-compact-small-plus',
                            )}
                          >
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <Text size="small" className="text-ui-fg-subtle">
                {t('offers.empty')}
              </Text>
            ))}
          {offers && (
            <form
              id="manual-offer"
              className="flex flex-col gap-y-4"
              onSubmit={save}
            >
              <div className="flex flex-col gap-y-1">
                <Heading level="h3">{t('offers.manual.heading')}</Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  {t('offers.manual.lead')}
                </Text>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {FIELDS.map((field) => (
                  <div key={field} className="flex flex-col gap-y-1">
                    <Label size="xsmall" htmlFor={`manual-offer-${field}`}>
                      {t(`offers.manual.fields.${field}`)}
                    </Label>
                    <Input
                      id={`manual-offer-${field}`}
                      type="number"
                      inputMode={field === 'cost_price' ? 'decimal' : 'numeric'}
                      {...INPUT_LIMITS[field]}
                      value={draft[field]}
                      aria-invalid={Boolean(errors[field])}
                      aria-describedby={
                        errors[field]
                          ? `manual-offer-${field}-error`
                          : undefined
                      }
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                    />
                    {errors[field] && (
                      <Text
                        id={`manual-offer-${field}-error`}
                        size="xsmall"
                        className="text-ui-fg-error"
                      >
                        {errors[field]}
                      </Text>
                    )}
                  </div>
                ))}
              </div>
            </form>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          {manual && (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={writing}
              onClick={remove}
            >
              {t('offers.manual.delete')}
            </Button>
          )}
          <Drawer.Close asChild>
            <Button variant="secondary" disabled={writing}>
              {t('common.close')}
            </Button>
          </Drawer.Close>
          <Button
            type="submit"
            form="manual-offer"
            disabled={writing || offers === null}
            isLoading={saving}
          >
            {t(manual ? 'common.save' : 'offers.manual.add')}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
