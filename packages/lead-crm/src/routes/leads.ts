import { z } from 'zod';
import {
  CONSENT_FIELD,
  CONTACT_INPUT_FIELDS,
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

export interface RefusalCopy {
  message: string;
  consent: string;
}

export interface LeadsRouteOptions<L extends string> {
  notifyLead: NotifyLead;
  waitUntil: (promise: Promise<unknown>) => void;
  isLocale: (value: string) => value is L;
  defaultLocale: L;
  localeCookie: string;
  thanksPath: (locale: L, service?: string) => string;
  refusalCopy: (locale: L) => RefusalCopy;
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

const RETYPED_FIELDS = new Set<string>(Object.values(CONTACT_INPUT_FIELDS));

const attribute = (text: string): string =>
  escapeHtml(text).replace(/"/g, '&quot;');

function refusalPage(
  locale: string,
  { message, consent }: RefusalCopy,
  form: FormData,
  action: string,
): Response {
  const consentBox = form.get(CONSENT_FIELD)
    ? ''
    : `
      <label><input type="checkbox" name="${CONSENT_FIELD}" value="1" required /> ${consent}</label>`;
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
    <form method="POST" action="${attribute(action)}">
      <label>${message} <input name="${CONTACT_INPUT_FIELDS.contact}" required autocomplete="tel" /></label>${consentBox}
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
  refusalCopy,
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
        refusalCopy(locale),
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
