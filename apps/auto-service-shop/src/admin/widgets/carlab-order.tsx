import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { AdminOrder, DetailWidgetProps } from '@medusajs/framework/types';
import {
  Badge,
  Button,
  Container,
  Copy,
  Heading,
  StatusBadge,
  Text,
} from '@medusajs/ui';
import { CARLAB } from '@podbor/brands';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { leadSchema, LeadStatus } from '../components/order-lead';
import { adminFetch } from '../lib/admin-fetch';

const orderSchema = z.object({
  order: z.object({
    display_id: z.number(),
    currency: z.string(),
    cash_at_pickup: z.boolean(),
    customer: z
      .object({
        name: z.string().nullable(),
        contact: z.string(),
        contact_channel: z.string().nullable(),
        vin: z.string().nullable(),
        car: z.string().nullable(),
        comment: z.string().nullable(),
      })
      .nullable(),
    lines: z.array(
      z.object({
        title: z.string(),
        quantity: z.number(),
        total: z.number(),
        addon: z.boolean(),
        in_stock: z.boolean().nullable(),
        lead_time_days: z.number().nullable(),
      }),
    ),
    total: z.number(),
    lead: leadSchema,
  }),
});

type CarlabOrder = z.infer<typeof orderSchema>['order'];
type Line = CarlabOrder['lines'][number];

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-x-4 px-6 py-3">
    <Text size="small" weight="plus" className="text-ui-fg-subtle">
      {label}
    </Text>
    <div className="text-ui-fg-base txt-compact-small min-w-0 break-words">
      {children}
    </div>
  </div>
);

const Copyable = ({ value }: { value: string }) => (
  <span className="inline-flex max-w-full items-center gap-x-1">
    <span className="break-all">{value}</span>
    <Copy content={value} className="text-ui-fg-muted shrink-0" />
  </span>
);

const Readiness = ({ line }: { line: Line }) => {
  const { t } = useTranslation('carlabAdmin');
  if (line.addon) {
    return <Badge size="2xsmall">{t('order.addon')}</Badge>;
  }
  if (line.lead_time_days) {
    return (
      <StatusBadge color="orange" className="whitespace-nowrap">
        {t('order.pickupIn', { count: line.lead_time_days })}
      </StatusBadge>
    );
  }
  return line.in_stock ? (
    <StatusBadge color="green" className="whitespace-nowrap">
      {t('order.inStock')}
    </StatusBadge>
  ) : null;
};

const CarlabOrderWidget = ({ data }: DetailWidgetProps<AdminOrder>) => {
  const { t, i18n } = useTranslation('carlabAdmin');
  const [order, setOrder] = useState<CarlabOrder | null>(null);

  useEffect(() => {
    adminFetch(`/admin/carlab-orders/${data.id}`, orderSchema).then(
      (found) => found && setOrder(found.order),
    );
  }, [data.id]);

  if (!order || (!order.customer && !order.cash_at_pickup)) {
    return null;
  }

  const money = (amount: number) =>
    `${amount.toLocaleString(i18n.language)} ${order.currency}`;
  const { customer } = order;

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
        <Heading level="h2">{t('order.heading')}</Heading>
        <LeadStatus lead={order.lead} compact />
      </div>

      {data.status === 'completed' && (
        <div className="px-6 py-4">
          <Button size="small" variant="secondary" asChild>
            <a
              href={`${CARLAB.url}/admin/work-draft?${new URLSearchParams({ order: data.id })}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('order.makeCase')}
            </a>
          </Button>
        </div>
      )}

      {order.cash_at_pickup && (
        <div className="flex flex-col gap-y-1 px-6 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <Text weight="plus">{t('order.cashAtPickup')}</Text>
            <Text size="xlarge" weight="plus" className="tabular-nums">
              {money(order.total)}
            </Text>
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            {t('order.paymentHint')}
          </Text>
        </div>
      )}

      {customer && (
        <div className="py-1">
          {customer.name && <Row label={t('order.name')}>{customer.name}</Row>}
          <Row label={t('order.contact')}>
            <div className="flex flex-col items-start gap-y-1">
              <Copyable value={customer.contact} />
              {customer.contact_channel && (
                <Badge size="2xsmall">
                  {t(`order.channels.${customer.contact_channel}`, {
                    defaultValue: customer.contact_channel,
                  })}
                </Badge>
              )}
            </div>
          </Row>
          {customer.vin && (
            <Row label={t('order.vin')}>
              <Copyable value={customer.vin} />
            </Row>
          )}
          {customer.car && <Row label={t('order.car')}>{customer.car}</Row>}
          {customer.comment && (
            <Row label={t('order.comment')}>
              <span className="whitespace-pre-line">{customer.comment}</span>
            </Row>
          )}
        </div>
      )}

      <ul className="divide-y">
        {order.lines.map((line, index) => (
          <li
            key={`${index}-${line.title}`}
            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-6 py-3"
          >
            <div className="flex min-w-0 flex-1 flex-col items-start gap-y-1">
              <Text size="small" className="break-words">
                {t('order.line', { title: line.title, count: line.quantity })}
              </Text>
              <Readiness line={line} />
            </div>
            <Text size="small" className="tabular-nums">
              {money(line.total)}
            </Text>
          </li>
        ))}
      </ul>

      <div className="px-6 py-4">
        <LeadStatus lead={order.lead} />
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({ zone: 'order.details.side.before' });

export default CarlabOrderWidget;
