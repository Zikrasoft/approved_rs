import type { NotifyLead } from '../notifyLead.ts';

export const MAX_FIELD_LENGTH = 200;
export const HONEYPOT_FIELD = 'website';
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_URL_LENGTH = 500;

const VISITOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function visitorId(value: string): string | null {
  return VISITOR_ID.test(value) ? value : null;
}

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
  thanksPath: (locale: L) => string;
  missingFieldsMessage: Record<L, string>;
}

export function createLeadsRoute<L extends string>({
  notifyLead,
  waitUntil,
  isLocale,
  defaultLocale,
  localeCookie,
  thanksPath,
  missingFieldsMessage,
}: LeadsRouteOptions<L>) {
  const messages = new Map<string, string>(
    Object.entries<string>(missingFieldsMessage),
  );

  return async function POST({
    request,
    redirect,
    cookies,
  }: RouteRequestContext): Promise<Response> {
    const form = await request.formData();

    const field = (key: string, max = MAX_FIELD_LENGTH) =>
      form.get(key)?.toString().trim().slice(0, max) ?? '';
    const name = field('name');
    const contact = field('contact');

    const requested = field('locale') || cookies.get(localeCookie)?.value;
    const locale: L =
      requested && isLocale(requested) ? requested : defaultLocale;

    if (field(HONEYPOT_FIELD)) {
      return redirect(thanksPath(locale), 302);
    }

    if (!name || !contact) {
      return new Response(messages.get(locale) ?? messages.get(defaultLocale), {
        status: 400,
      });
    }

    const car = field('car');
    const note = field('comment', MAX_COMMENT_LENGTH);
    const comment = [car, note].filter(Boolean).join('\n');

    waitUntil(
      notifyLead(
        {
          name,
          contact,
          service: field('service'),
          contactChannel: field('contact_channel') || null,
          comment: comment || null,
          country: field('country') || null,
          source_url: field('source_url', MAX_URL_LENGTH) || null,
          visitorId: visitorId(field('visitor_id')),
          locale,
        },
        '[leads]',
      ),
    );

    return redirect(thanksPath(locale), 302);
  };
}
