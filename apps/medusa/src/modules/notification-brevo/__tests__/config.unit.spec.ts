import { brevoOptions } from '../config';

describe('brevoOptions', () => {
  it('configures Brevo when the key and the sender are set', () => {
    expect(
      brevoOptions({
        BREVO_API_KEY: 'xkeysib-1',
        BREVO_FROM_EMAIL: 'shop@carlab.rs',
        BREVO_FROM_NAME: 'CarLab',
      }),
    ).toEqual({
      apiKey: 'xkeysib-1',
      fromEmail: 'shop@carlab.rs',
      fromName: 'CarLab',
    });
  });

  it('leaves Brevo off without a key, so the local provider takes over', () => {
    expect(
      brevoOptions({
        BREVO_API_KEY: undefined,
        BREVO_FROM_EMAIL: undefined,
        BREVO_FROM_NAME: undefined,
      }),
    ).toBeUndefined();
  });
});
