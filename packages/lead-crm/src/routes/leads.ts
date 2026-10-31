import { z } from 'zod';
import {
  ORDER_CANCELED,
  ORDER_ID_FIELD,
  ORDER_OUTCOME_FIELD,
} from '../fields.ts';
import { leadEnvelopeSchema, leadSubmissionSchema } from '../form.ts';
import { escapeHtml } from '../telegram/markup.ts';
import { bearerToken, secretMatches } from '../verifySecret.ts';
import type { NotifyLead } from '../notifyLead.ts';
import type { CancelOrderResult } from '../brandBot.ts';

const CANCEL_STATUS: Record<CancelOrderResult, number> = {
  lost: 204,
  won: 409,
  missing: 404,
};

export interface RouteRequestContext {
  request: Request;
  cookies: { get(name: string): { value: string } | undefined };
  redirect(path: string, status?: number): Response;
}

export interface LeadsRouteOptions<L extends string> {
  notifyLead: NotifyLead;
  waitUntil: (promise: Promise<unknown>) => void;
  isLocale: (value: string) => value is L;
  defaultLocale: L;
  localeCookie: string;
  thanksPath: (locale: L, service?: string) => string;
  missingFieldsMessage: Record<L, string>;
  // TODO: drop orderCanceled and both shop branches below one release after createShopOrdersRoute ships, once no deployed shop posts orders here.
  orderCanceled?: {
    secret: string | undefined;
    cancel: (orderId: string) => Promise<CancelOrderResult>;
  };
}

const orderCancelSchema = z.object({
  [ORDER_ID_FIELD]: z.string().min(1),
  [ORDER_OUTCOME_FIELD]: z.literal(ORDER_CANCELED),
});

async function cancelOrder(
  request: Request,
  orderId: string,
  orderCanceled: LeadsRouteOptions<string>['orderCanceled'],
): Promise<Response> {
  const bearer = bearerToken(request.headers.get('authorization'));
  if (!orderCanceled || !secretMatches(bearer, orderCanceled.secret))
    return new Response(null, { status: 401 });
  return new Response(null, {
    status: CANCEL_STATUS[await orderCanceled.cancel(orderId)],
  });
}

const RETYPED_FIELDS = new Set([
  'contact',
  'contact_channel',
  'phone_number',
  'phone_country',
  'telegram',
]);

const attribute = (text: string): string =>
  escapeHtml(text).replace(/"/g, '&quot;');

function refusalPage(
  locale: string,
  message: string,
  form: FormData,
  action: string,
): Response {
  const kept: string[] = [];
  form.forEach((value, name) => {
    if (typeof value === 'string' && !RETYPED_FIELDS.has(name)) {
      kept.push(
        `      <input type="hidden" name="${attribute(name)}" value="${attribute(value)}" />`,
      );
    }
  });
  return new Response(
    `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${message}</title>
  </head>
  <body>
    <p>${message}</p>
    <form method="POST" action="${attribute(action)}">
      <input name="contact" required autocomplete="tel" aria-label="${message}" />
${kept.join('\n')}
      <input type="submit" />
    </form>
  </body>
</html>
`,
    { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

export function createLeadsRoute<L extends string>({
  notifyLead,
  waitUntil,
  isLocale,
  defaultLocale,
  localeCookie,
  thanksPath,
  missingFieldsMessage,
  orderCanceled,
}: LeadsRouteOptions<L>) {
  return async function POST({
    request,
    redirect,
    cookies,
  }: RouteRequestContext): Promise<Response> {
    const form = await request.formData().catch(() => new FormData());
    const canceled = orderCancelSchema.safeParse({
      [ORDER_ID_FIELD]: form.get(ORDER_ID_FIELD),
      [ORDER_OUTCOME_FIELD]: form.get(ORDER_OUTCOME_FIELD),
    });
    if (canceled.success)
      return cancelOrder(request, canceled.data[ORDER_ID_FIELD], orderCanceled);
    const envelope = leadEnvelopeSchema.parse(form);

    const requested = envelope.locale || cookies.get(localeCookie)?.value;
    const locale: L =
      requested && isLocale(requested) ? requested : defaultLocale;

    if (envelope.website) {
      console.log('[leads] dropped by the honeypot', { locale });
      return redirect(thanksPath(locale), 302);
    }

    if (!form.get('source_url')) {
      form.set('source_url', request.headers.get('referer') ?? '');
    }
    const submission = leadSubmissionSchema.safeParse(form);
    if (!submission.success) {
      return refusalPage(
        locale,
        missingFieldsMessage[locale],
        form,
        new URL(request.url).pathname,
      );
    }
    if (submission.data.orderId) {
      if (
        !secretMatches(
          bearerToken(request.headers.get('authorization')),
          orderCanceled?.secret,
        )
      )
        return new Response(null, { status: 401 });
      const { stored, delivered } = await notifyLead(
        { ...submission.data, locale },
        '[leads]',
      );
      return new Response(null, { status: stored || delivered ? 201 : 503 });
    }

    waitUntil(notifyLead({ ...submission.data, locale }, '[leads]'));

    return redirect(thanksPath(locale, submission.data.service), 302);
  };
}
