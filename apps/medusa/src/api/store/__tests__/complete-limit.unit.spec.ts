import {
  MAX_COMPLETIONS_PER_IP,
  limitCartCompletions,
} from '../complete-limit';

const complete = (ip: string) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  limitCartCompletions({ ip } as never, res as never, next as never);
  return {
    refused: res.status.mock.calls[0]?.[0] === 429,
    body: res.json.mock.calls[0]?.[0],
    next,
  };
};

describe('the checkout limiter', () => {
  it('lets a few orders a minute through from one address', () => {
    for (let order = 0; order < MAX_COMPLETIONS_PER_IP; order += 1) {
      expect(complete('198.51.100.1').refused).toBe(false);
    }
  });

  it('refuses a script placing order after order, in Russian', () => {
    for (let order = 0; order < MAX_COMPLETIONS_PER_IP; order += 1) {
      complete('198.51.100.2');
    }

    const { refused, body, next } = complete('198.51.100.2');

    expect(refused).toBe(true);
    expect(next).not.toHaveBeenCalled();
    expect(body.message).toMatch(/[а-яё]/i);
  });

  it('counts each address on its own', () => {
    for (let order = 0; order < MAX_COMPLETIONS_PER_IP; order += 1) {
      complete('198.51.100.3');
    }

    expect(complete('198.51.100.4').refused).toBe(false);
  });
});
