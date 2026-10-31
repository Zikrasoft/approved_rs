import { requireShopLeadSecret } from '../bearer-secret';

const verdict = (authorization: string) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  requireShopLeadSecret(
    { headers: { authorization } } as never,
    res as never,
    next,
  );
  return next.mock.calls.length ? 'passed' : res.status.mock.calls[0][0];
};

describe('requireShopLeadSecret', () => {
  beforeEach(() => {
    process.env.SHOP_LEAD_SECRET = 'new-lead-secret';
    process.env.SHOP_LEAD_SECRET_PREVIOUS = 'old-lead-secret';
  });

  afterEach(() => {
    delete process.env.SHOP_LEAD_SECRET;
    delete process.env.SHOP_LEAD_SECRET_PREVIOUS;
  });

  it('takes the current and the previous secret while one rotates', () => {
    expect(verdict('Bearer new-lead-secret')).toBe('passed');
    expect(verdict('Bearer old-lead-secret')).toBe('passed');
    expect(verdict('Bearer bad-lead-secret')).toBe(401);
  });

  it('forgets the previous secret once it is emptied', () => {
    process.env.SHOP_LEAD_SECRET_PREVIOUS = '';

    expect(verdict('Bearer old-lead-secret')).toBe(401);
  });
});
