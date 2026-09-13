import { leadEnvelopeSchema, leadSubmissionSchema } from '../form.ts';
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
  return async function POST({
    request,
    redirect,
    cookies,
  }: RouteRequestContext): Promise<Response> {
    const form = await request.formData();
    const envelope = leadEnvelopeSchema.parse(form);

    const requested = envelope.locale || cookies.get(localeCookie)?.value;
    const locale: L =
      requested && isLocale(requested) ? requested : defaultLocale;

    if (envelope.website) {
      return redirect(thanksPath(locale), 302);
    }

    const submission = leadSubmissionSchema.safeParse(form);
    if (!submission.success) {
      return new Response(missingFieldsMessage[locale], { status: 400 });
    }

    waitUntil(notifyLead({ ...submission.data, locale }, '[leads]'));

    return redirect(thanksPath(locale), 302);
  };
}
