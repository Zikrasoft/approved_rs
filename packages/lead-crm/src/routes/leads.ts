import { z } from 'zod';
import {
  CONSENT_FIELD,
  CONTACT_INPUT_FIELDS,
  ORDER_CANCELED,
  ORDER_ID_FIELD,
  ORDER_OUTCOME_FIELD,
} from '../fields.ts';
import {
  leadEnvelopeSchema,
  leadRefusal,
  leadSubmissionSchema,
  siteUrl,
  type LeadRefusal,
} from '../form.ts';
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
  reasons: Record<LeadRefusal, string>;
  consent: string;
  submit: string;
  links: { label: string; href: string }[];
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

const RETYPED_FIELDS = new Set<string>([
  CONTACT_INPUT_FIELDS.contact,
  CONTACT_INPUT_FIELDS.phoneNumber,
  CONTACT_INPUT_FIELDS.phoneCountry,
  CONTACT_INPUT_FIELDS.telegram,
]);

const attribute = (text: string): string =>
  escapeHtml(text).replace(/"/g, '&quot;');

const REFUSAL_STYLE = `body{font:16px/1.5 system-ui,sans-serif;max-width:28rem;margin:0 auto;padding:1.5rem 1rem}
label{display:block;margin:0 0 1rem}
input:not([type=checkbox]){display:block;box-sizing:border-box;width:100%;min-height:44px;margin-top:.5rem;font:inherit;padding:0 .75rem}
button{min-height:44px;padding:0 1.25rem;font:inherit}
input[type=checkbox]{width:20px;height:20px;vertical-align:middle;margin-right:.5rem}
ul{list-style:none;padding:0;display:flex;gap:1rem;flex-wrap:wrap}
a{display:inline-block;min-height:44px;line-height:44px}
@media (pointer:fine){.tel{display:none}}`;

function refusalPage(
  locale: string,
  copy: RefusalCopy,
  form: FormData,
  action: string,
): Response {
  const { reason, contact } = leadRefusal(form);
  const message = copy.reasons[reason];
  const consentBox = form.get(CONSENT_FIELD)
    ? ''
    : `
      <label><input type="checkbox" name="${CONSENT_FIELD}" value="1" required />${escapeHtml(copy.consent)}</label>`;
  const kept: string[] = [];
  form.forEach((value, name) => {
    if (typeof value === 'string' && !RETYPED_FIELDS.has(name)) {
      kept.push(
        `      <input type="hidden" name="${attribute(name)}" value="${attribute(value)}" />`,
      );
    }
  });
  const links = copy.links
    .map(
      ({ label, href }) =>
        `      <li${href.startsWith('tel:') ? ' class="tel"' : ''}><a href="${attribute(href)}">${escapeHtml(label)}</a></li>`,
    )
    .join('\n');
  return new Response(
    `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>${escapeHtml(message)}</title>
    <style>${REFUSAL_STYLE}</style>
  </head>
  <body>
    <form method="POST" action="${attribute(action)}">
      <label>${escapeHtml(message)}<input name="${CONTACT_INPUT_FIELDS.contact}" value="${attribute(contact)}" required autocomplete="tel" /></label>${consentBox}
${kept.join('\n')}
      <button type="submit">${escapeHtml(copy.submit)}</button>
    </form>
    <ul>
${links}
    </ul>
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
    const parsed = leadSubmissionSchema.safeParse(form);
    if (!parsed.success) {
      return refusalPage(
        locale,
        refusalCopy(locale),
        form,
        new URL(request.url).pathname,
      );
    }
    const submission = {
      ...parsed.data,
      source_url: siteUrl(parsed.data.source_url, new URL(request.url).origin),
      locale,
    };
    if (submission.orderId) {
      if (
        !secretMatches(
          bearerToken(request.headers.get('authorization')),
          orderCanceled?.secret,
        )
      )
        return new Response(null, { status: 401 });
      const { stored, delivered } = await notifyLead(submission, '[leads]');
      return new Response(null, { status: stored || delivered ? 201 : 503 });
    }

    waitUntil(notifyLead(submission, '[leads]'));

    return redirect(thanksPath(locale, submission.service), 302);
  };
}
