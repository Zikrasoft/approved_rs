import type { NotifyLead } from '../notifyLead.ts';

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

    const field = (key: string) => form.get(key)?.toString().trim() ?? '';
    const name = field('name');
    const contact = field('contact');

    const cookieLocale = cookies.get(localeCookie)?.value;
    const locale: L =
      cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

    if (!name || !contact) {
      return new Response(messages.get(locale) ?? messages.get(defaultLocale), {
        status: 400,
      });
    }

    waitUntil(
      notifyLead(
        {
          name,
          contact,
          service: field('service'),
          contactChannel: field('contact_channel') || null,
          comment: field('comment') || null,
          country: form.get('country')?.toString() || null,
          source_url: form.get('source_url')?.toString() || null,
          visitorId: form.get('visitor_id')?.toString() || null,
          locale,
        },
        '[leads]',
      ),
    );

    return redirect(thanksPath(locale), 302);
  };
}
