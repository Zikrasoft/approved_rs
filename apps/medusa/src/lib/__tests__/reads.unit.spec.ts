import { BigNumber } from '@medusajs/framework/utils';
import type { z } from 'zod';

import {
  idRowSchema,
  storedProductSchema,
  typeValueSchema,
} from '../../api/admin/products/require-fields';
import { specProductSchema } from '../../api/admin/products/[id]/spec/route';
import { uncollectedOrderSchema } from '../../jobs/release-uncollected';
import { emailOrderSchema } from '../../subscribers/order-placed-email';
import { metadataRowSchema } from '../metadata';
import { hookOrderSchema, hookProductSchema } from '../order-hook';
import { fieldsOf } from '../query';
import { sourceRowSchema } from '../translate-product';

const created = new Date('2026-10-01T09:30:00.000Z');

const ORDER_ROW = {
  id: 'order_01K',
  display_id: 7,
  email: 'kupac@example.com',
  locale: 'sr-RS',
  total: new BigNumber({ value: '12690', precision: 20 }),
  metadata: null,
  shipping_address: {
    id: 'caaddr_01K',
    first_name: 'Marko',
    last_name: null,
    phone: '+381601234567',
  },
  items: [
    {
      id: 'ordli_01K',
      product_id: 'prod_01K',
      product_title: 'Bosch S4 024',
      title: 'Default',
      quantity: new BigNumber(1),
      unit_price: new BigNumber(11190),
      total: new BigNumber({ value: '11190', precision: 20 }),
    },
    {
      id: 'ordli_02K',
      product_id: null,
      product_title: null,
      title: 'Ugradnja',
      quantity: 1,
      unit_price: 1500,
      total: 1500,
    },
  ],
};

const PRODUCT_ROW = {
  id: 'prod_01K',
  title: 'Аккумулятор Bosch S4 024',
  subtitle: null,
  description: 'Для легковых автомобилей',
  status: 'draft',
  metadata: { spec: { capacity: 60 }, translated_from_sr: 'abc' },
  type: { id: 'ptyp_01K', value: 'batteries' },
  variants: [
    {
      id: 'variant_01K',
      title: 'Default',
      prices: [{ id: 'price_01K', amount: 11190, currency_code: 'rsd' }],
    },
  ],
};

type Read = [string, z.ZodType, string[], unknown];

const READS: Read[] = [
  [
    'order card',
    hookOrderSchema,
    [
      'id',
      'display_id',
      'email',
      'locale',
      'total',
      'metadata',
      'shipping_address.first_name',
      'shipping_address.last_name',
      'shipping_address.phone',
      'items.product_id',
      'items.product_title',
      'items.quantity',
      'items.unit_price',
    ],
    ORDER_ROW,
  ],
  [
    'order card products',
    hookProductSchema,
    ['id', 'title', 'type.value'],
    PRODUCT_ROW,
  ],
  [
    'order email',
    emailOrderSchema,
    [
      'id',
      'display_id',
      'email',
      'locale',
      'total',
      'items.product_title',
      'items.title',
      'items.quantity',
      'items.total',
    ],
    ORDER_ROW,
  ],
  [
    'translation source',
    sourceRowSchema,
    ['id', 'title', 'subtitle', 'description', 'metadata'],
    PRODUCT_ROW,
  ],
  [
    'metadata merge',
    metadataRowSchema,
    ['id', 'metadata'],
    { id: 'store_01K', metadata: null },
  ],
  ['spec route', specProductSchema, ['id', 'type.value'], PRODUCT_ROW],
  ['product defaults', idRowSchema, ['id'], { id: 'sp_01K' }],
  [
    'registry type',
    typeValueSchema,
    ['value'],
    { id: 'ptyp_01K', value: 'batteries' },
  ],
  [
    'product guards',
    storedProductSchema,
    [
      'status',
      'metadata',
      'type.value',
      'variants.id',
      'variants.title',
      'variants.prices.currency_code',
      'variants.prices.amount',
    ],
    PRODUCT_ROW,
  ],
  [
    'uncollected orders',
    uncollectedOrderSchema,
    ['id', 'fulfillments.canceled_at', 'payment_collections.captured_amount'],
    {
      id: 'order_01K',
      fulfillments: [{ id: 'ful_01K', canceled_at: created }],
      payment_collections: [
        { id: 'pay_col_01K', captured_amount: new BigNumber(0) },
        { id: 'pay_col_02K', captured_amount: null },
      ],
    },
  ],
];

describe.each(READS)('the %s read', (_name, schema, fields, row) => {
  it('asks query.graph for exactly the fields it parses', () => {
    expect(fieldsOf(schema)).toEqual(fields);
  });

  it('parses a row shaped the way query.graph returns it', () => {
    expect(schema.safeParse(row).error).toBeUndefined();
  });
});
