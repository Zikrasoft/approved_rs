import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { POST } from '../[id]/outcome/route';

jest.mock('@medusajs/medusa/core-flows', () => ({
  completeOrderWorkflow: jest.fn(),
  cancelOrderWorkflow: () => ({
    run: () => Promise.reject(new Error('fulfillments must be canceled')),
  }),
}));

describe('a CRM loss the shop cannot cancel', () => {
  it('leaves the Order without a lost mark, so the shop admin cancel still tells the bot', async () => {
    let metadata: Record<string, unknown> = { contact: '+381601234567' };
    const orders = {
      retrieveOrder: async () => ({
        id: 'order_1',
        status: 'pending',
        metadata,
      }),
      updateOrders: async (
        _id: string,
        update: { metadata: typeof metadata },
      ) => {
        metadata = update.metadata;
      },
    };
    const req = {
      validatedBody: { outcome: 'canceled' },
      params: { id: 'order_1' },
      scope: {
        resolve: (key: string) =>
          key === 'locking'
            ? { execute: (_key: string, job: () => unknown) => job() }
            : orders,
      },
    } as unknown as MedusaRequest<{ outcome: 'canceled' }>;

    await expect(POST(req, {} as MedusaResponse)).rejects.toThrow(
      'fulfillments must be canceled',
    );

    expect(metadata.lead_lost_at).toBeFalsy();
    expect(metadata.contact).toBe('+381601234567');
  });
});
