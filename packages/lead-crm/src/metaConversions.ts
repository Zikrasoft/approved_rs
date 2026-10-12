import { z } from 'zod';
import type { ClaimedMetaLead } from './store.ts';

export const META_GRAPH_VERSION = 'v25.0';
const TIMEOUT_MS = 5000;

const metaEnvSchema = z.object({
  META_CAPI_TOKEN: z.string().trim().min(1).optional().catch(undefined),
  META_CAPI_TEST_CODE: z.string().trim().min(1).optional().catch(undefined),
});

type SentLead = Pick<ClaimedMetaLead, 'id' | 'metaIds' | 'metaLeadSentAt'>;

export function metaLeadEvent(lead: SentLead, testEventCode?: string) {
  const { fbc, fbp } = lead.metaIds ?? {};
  return {
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.parse(lead.metaLeadSentAt) / 1000),
        event_id: `lead-${lead.id}`,
        action_source: 'chat',
        user_data: { ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}) },
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };
}

export type ReportMetaLead = (lead: SentLead) => void;

export interface MetaLeadReporterOptions {
  pixelId: string | undefined;
  env: Record<string, unknown>;
  waitUntil: (promise: Promise<unknown>) => void;
  timeoutMs?: number;
}

export function createMetaLeadReporter({
  pixelId,
  env,
  waitUntil,
  timeoutMs = TIMEOUT_MS,
}: MetaLeadReporterOptions): ReportMetaLead | undefined {
  const { META_CAPI_TOKEN: token, META_CAPI_TEST_CODE: testCode } =
    metaEnvSchema.parse(env);
  if (!pixelId || !token) {
    console.info('[meta-capi] off: no pixel id or META_CAPI_TOKEN');
    return undefined;
  }
  const auth = { access_token: token };
  const endpoint = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events`;

  async function send(lead: SentLead): Promise<void> {
    try {
      const { data, ...rest } = metaLeadEvent(lead, testCode);
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({
          ...rest,
          data: JSON.stringify(data),
          ...auth,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok)
        console.error('[meta-capi] Lead event refused', {
          leadId: lead.id,
          status: response.status,
          body: await response.text(),
        });
    } catch (error) {
      console.error('[meta-capi] could not send the Lead event', {
        leadId: lead.id,
        error,
      });
    }
  }

  return (lead) => waitUntil(send(lead));
}
