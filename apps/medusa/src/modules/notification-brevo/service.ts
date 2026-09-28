import type { Logger, NotificationTypes } from '@medusajs/framework/types';
import {
  AbstractNotificationProviderService,
  MedusaError,
} from '@medusajs/framework/utils';

export type BrevoOptions = {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  fetchImpl?: typeof fetch;
};

type InjectedDependencies = { logger: Logger };

export const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

const REQUEST_TIMEOUT_MS = 15_000;

class BrevoNotificationService extends AbstractNotificationProviderService {
  static identifier = 'brevo';

  static validateOptions(options: Record<string, unknown>): void {
    for (const key of ['apiKey', 'fromEmail']) {
      if (!options[key]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_ARGUMENT,
          `Brevo needs ${key} — see BREVO_* in apps/medusa/.env.example.`,
        );
      }
    }
  }

  readonly #logger: Logger;
  readonly #options: BrevoOptions;
  readonly #fetch: typeof fetch;

  constructor({ logger }: InjectedDependencies, options: BrevoOptions) {
    super();
    this.#logger = logger;
    this.#options = options;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async send(
    notification: NotificationTypes.ProviderSendNotificationDTO,
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    const content = notification.content;
    if (!content?.subject || !content.html) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Notification ${notification.template} carries no subject or HTML body`,
      );
    }

    const response = await this.#fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        'api-key': this.#options.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: this.#options.fromEmail,
          ...(this.#options.fromName ? { name: this.#options.fromName } : {}),
        },
        to: [{ email: notification.to }],
        subject: content.subject,
        htmlContent: content.html,
        ...(content.text ? { textContent: content.text } : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Brevo refused the message: HTTP ${response.status}`,
      );
    }

    this.#logger.info(`Brevo accepted a ${notification.template} message`);
    return {};
  }
}

export default BrevoNotificationService;
