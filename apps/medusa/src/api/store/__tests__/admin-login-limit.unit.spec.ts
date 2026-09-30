import {
  limitIdentityRegistrations,
  limitPasswordLogins,
  limitPasswordResets,
} from '../admin-login-limit';

type Middleware = typeof limitPasswordLogins;

const call = (
  middleware: Middleware,
  params: Record<string, string>,
  email: unknown,
  ip = `ip_${Math.random()}`,
) => {
  const next = jest.fn();
  const res = { status: jest.fn().mockReturnValue({ json: jest.fn() }) };
  middleware(
    { params, body: { email }, ip } as never,
    res as never,
    next as never,
  );
  return { next, status: res.status };
};

const login = (email: unknown, ip?: string, actorType = 'user') =>
  call(
    limitPasswordLogins,
    { actor_type: actorType, auth_provider: 'emailpass' },
    email,
    ip,
  );

describe('limitPasswordLogins', () => {
  it('refuses the eleventh attempt from one address', () => {
    const ip = `ip_${Math.random()}`;
    for (let i = 0; i < 10; i += 1) {
      expect(login(`a${i}_${ip}@x.rs`, ip).next).toHaveBeenCalled();
    }
    expect(login(`fresh_${ip}@x.rs`, ip).status).toHaveBeenCalledWith(429);
  });

  it('throttles one account across many addresses, whatever case the email is in', () => {
    const email = `owner_${Math.random()}@x.rs`;
    for (let i = 0; i < 10; i += 1) {
      login(i % 2 ? email : ` ${email.toUpperCase()} `);
    }
    expect(login(email).status).toHaveBeenCalledWith(429);
  });

  it('decides on the decoded provider, so an upper-case path is still counted', () => {
    const ip = `ip_${Math.random()}`;
    for (let i = 0; i < 10; i += 1) {
      call(
        limitPasswordLogins,
        { actor_type: 'user', auth_provider: 'EmailPass' },
        `e${i}_${ip}@x.rs`,
        ip,
      );
    }
    expect(login(`e_${ip}@x.rs`, ip).status).toHaveBeenCalledWith(429);
  });

  it('leaves other auth routes on the same shape alone', () => {
    const ip = `ip_${Math.random()}`;
    for (let i = 0; i < 20; i += 1) {
      expect(
        call(
          limitPasswordLogins,
          { actor_type: 'user', auth_provider: 'token' },
          undefined,
          ip,
        ).next,
      ).toHaveBeenCalled();
    }
  });
});

describe('limitIdentityRegistrations', () => {
  it('refuses the fourth password registration from one address', () => {
    const ip = `ip_${Math.random()}`;
    const register = () =>
      call(
        limitIdentityRegistrations,
        { actor_type: 'user', auth_provider: 'emailpass' },
        undefined,
        ip,
      );
    for (let i = 0; i < 3; i += 1) expect(register().next).toHaveBeenCalled();
    expect(register().status).toHaveBeenCalledWith(429);
  });
});

describe('limitPasswordResets', () => {
  it('refuses the fourth reset letter asked from one address', () => {
    const ip = `ip_${Math.random()}`;
    const reset = () =>
      call(
        limitPasswordResets,
        { actor_type: 'user', auth_provider: 'emailpass' },
        undefined,
        ip,
      );
    for (let i = 0; i < 3; i += 1) expect(reset().next).toHaveBeenCalled();
    expect(reset().status).toHaveBeenCalledWith(429);
  });
});
