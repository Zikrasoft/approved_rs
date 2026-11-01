import { z } from 'zod';
import { readJson } from '../bodySize.ts';

export const CSP_REPORT_MAX_BYTES = 8 * 1024;

const keyword = z
  .string()
  .regex(/^[a-z-]{1,40}$/)
  .catch('-');

const blockedHost = (blocked: string | undefined): string => {
  if (!blocked) return '-';
  try {
    const url = new URL(blocked);
    return url.host || url.protocol.replace(':', '');
  } catch {
    return keyword.parse(blocked);
  }
};

const legacyReportSchema = z
  .object({
    'csp-report': z.object({
      'effective-directive': z.string().optional(),
      'violated-directive': z.string().optional(),
      'blocked-uri': z.string().optional(),
    }),
  })
  .transform(({ 'csp-report': report }) => [
    {
      directive: report['effective-directive'] ?? report['violated-directive'],
      blocked: report['blocked-uri'],
    },
  ]);

const reportingBatchSchema = z
  .array(
    z.object({
      type: z.string(),
      body: z
        .object({
          effectiveDirective: z.string().optional(),
          blockedURL: z.string().optional(),
        })
        .optional(),
    }),
  )
  .transform((reports) =>
    reports
      .filter(({ type }) => type === 'csp-violation')
      .map(({ body }) => ({
        directive: body?.effectiveDirective,
        blocked: body?.blockedURL,
      })),
  );

const violationsSchema = z.union([legacyReportSchema, reportingBatchSchema]);

export type CspViolation = { directive: string; blocked: string };

export function createCspReportRoute(
  onViolation: (violation: CspViolation) => void = () => {},
) {
  return async function cspReportRoute({
    request,
  }: {
    request: Request;
  }): Promise<Response> {
    const read = await readJson(request, CSP_REPORT_MAX_BYTES);
    if ('response' in read) return read.response;
    const parsed = violationsSchema.safeParse(read.value);
    if (!parsed.success) return new Response(null, { status: 400 });
    for (const report of parsed.data) {
      const violation = {
        directive: keyword.parse(report.directive),
        blocked: blockedHost(report.blocked),
      };
      console.info(`[csp] ${violation.directive} ${violation.blocked}`);
      onViolation(violation);
    }
    return new Response(null, { status: 204 });
  };
}

export const cspReportRoute = createCspReportRoute();
