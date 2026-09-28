import BrevoNotificationService, { BREVO_SEND_URL } from '../service';

const logger = { info: jest.fn() };

const OPTIONS = {
  apiKey: 'xkeysib-test',
  fromEmail: 'shop@carlab.rs',
  fromName: 'CarLab',
};

const NOTE = {
  to: 'kupac@example.com',
  channel: 'email',
  template: 'order-placed',
  content: { subject: 'Заказ №7 принят', html: '<p>Hvala</p>', text: 'Hvala' },
};

const service = (fetchImpl: jest.Mock, options: object = {}) =>
  new BrevoNotificationService(
    { logger } as never,
    { ...OPTIONS, fetchImpl, ...options } as never,
  );

const accepted = () =>
  jest.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' });

describe('BrevoNotificationService', () => {
  it('sends the message through the Brevo transactional API', async () => {
    const fetchImpl = accepted();

    expect(await service(fetchImpl).send(NOTE as never)).toEqual({});

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(BREVO_SEND_URL).toBe(url);
    expect(init.method).toBe('POST');
    expect(init.headers['api-key']).toBe('xkeysib-test');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      sender: { email: 'shop@carlab.rs', name: 'CarLab' },
      to: [{ email: 'kupac@example.com' }],
      subject: 'Заказ №7 принят',
      htmlContent: '<p>Hvala</p>',
      textContent: 'Hvala',
    });
  });

  it('leaves textContent out when the notification has no plain-text body', async () => {
    const fetchImpl = accepted();

    await service(fetchImpl).send({
      ...NOTE,
      content: { subject: NOTE.content.subject, html: NOTE.content.html },
    } as never);

    expect(
      JSON.parse(fetchImpl.mock.calls[0][1].body).textContent,
    ).toBeUndefined();
  });

  it('leaves the sender name out when none is configured', async () => {
    const fetchImpl = accepted();

    await service(fetchImpl, { fromName: undefined }).send(NOTE as never);

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).sender).toEqual({
      email: 'shop@carlab.rs',
    });
  });

  it('throws with only the status, never the response body, so the event bus retries', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Key not found, sent to kupac@example.com',
    });

    await expect(service(fetchImpl).send(NOTE as never)).rejects.toThrow(
      new Error('Brevo refused the message: HTTP 401'),
    );
  });

  it('refuses a notification without a subject or HTML before calling Brevo', async () => {
    const fetchImpl = accepted();

    await expect(
      service(fetchImpl).send({ ...NOTE, content: { subject: 'x' } } as never),
    ).rejects.toThrow('no subject or HTML');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses to start without a key or a sender', () => {
    expect(() =>
      BrevoNotificationService.validateOptions({ fromEmail: 'x' }),
    ).toThrow('apiKey');
    expect(() =>
      BrevoNotificationService.validateOptions({ apiKey: 'k' }),
    ).toThrow('fromEmail');
    expect(() =>
      BrevoNotificationService.validateOptions(OPTIONS),
    ).not.toThrow();
  });
});
