import { defineWidgetConfig } from '@medusajs/admin-sdk';
import { Alert, Text } from '@medusajs/ui';
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { leadSchema } from '../components/order-lead';
import { adminFetch } from '../lib/admin-fetch';

const ordersSchema = z.object({
  orders: z.array(
    z.object({ id: z.string(), display_id: z.number(), lead: leadSchema }),
  ),
});

type Order = z.infer<typeof ordersSchema>['orders'][number];

const OrdersWithoutLead = () => {
  const { t } = useTranslation('carlabAdmin');
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    adminFetch('/admin/carlab-orders', ordersSchema).then(
      (found) => found && setOrders(found.orders),
    );
  }, []);

  if (!orders.length) {
    return null;
  }

  return (
    <Alert variant="warning">
      <Text size="small" weight="plus">
        {t('order.withoutLead.title', { count: orders.length })}
      </Text>
      <Text size="small">
        {orders.map((order, index) => (
          <Fragment key={order.id}>
            {index > 0 && ', '}
            <Link
              to={`/orders/${order.id}`}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
            >
              #{order.display_id}
            </Link>
          </Fragment>
        ))}
      </Text>
      <Text size="small" className="text-ui-fg-subtle">
        {t('order.withoutLead.hint')}
      </Text>
    </Alert>
  );
};

export const config = defineWidgetConfig({ zone: 'order.list.before' });

export default OrdersWithoutLead;
