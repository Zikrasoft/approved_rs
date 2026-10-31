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
import {
  bearerToken,
  secretMatches,
  type AcceptedSecrets,
} from '../verifySecret.ts';
import { readForm } from '../bodySize.ts';
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

export interface RefusalBrand {
  name: string;
  background: string;
  text: string;
  accent: string;
  onAccent: string;
}

export interface RefusalCopy {
  brand: RefusalBrand;
  reasons: Record<LeadRefusal, string>;
  consent: string;
  privacy: { label: string; href: string };
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
    secret: AcceptedSecrets;
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

const refusalStyle = (brand: RefusalBrand): string =>
  `body{font:16px/1.5 system-ui,sans-serif;max-width:28rem;margin:0 auto;padding:1.5rem 1rem;background:${brand.background};color:${brand.text}}
h1{font-size:1.25rem;line-height:1.3;margin:0 0 1.5rem}
label{display:block;margin:0 0 1rem}
input:not([type=checkbox]){display:block;box-sizing:border-box;width:100%;min-height:44px;margin-top:.5rem;font:inherit;padding:0 .75rem;color:inherit;background:transparent;border:1px solid;border-radius:12px}
input[type=checkbox]{width:20px;height:20px;vertical-align:middle;margin:0 .5rem 0 0;accent-color:${brand.accent}}
a{color:inherit}
button{display:block;width:100%;min-height:44px;font:inherit;font-weight:600;border:0;border-radius:12px;background:${brand.accent};color:${brand.onAccent};cursor:pointer}
ul{list-style:none;padding:0;margin:1.5rem 0 0;display:grid;gap:.5rem}
li a{display:flex;align-items:center;justify-content:center;min-height:44px;border:1px solid;border-radius:12px;text-decoration:none}
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
      <label><input type="checkbox" name="${CONSENT_FIELD}" value="1" required />${escapeHtml(copy.consent)}</label>
      <p><a href="${attribute(copy.privacy.href)}" target="_blank">${escapeHtml(copy.privacy.label)}</a></p>`;
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
    <title>${escapeHtml(message)}</title>
    <style>${refusalStyle(copy.brand)}</style>
  </head>
  <body>
    <h1>${escapeHtml(copy.brand.name)}</h1>
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
    const read = await readForm(request);
    if ('response' in read) return read.response;
    const form = read.value ?? new FormData();
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
