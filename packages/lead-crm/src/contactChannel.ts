export const TRACKED_CONTACT_CHANNELS = [
  'phone',
  'telegram',
  'whatsapp',
  'viber',
] as const;

export type TrackedContactChannel = (typeof TRACKED_CONTACT_CHANNELS)[number];

export function isTrackedContactChannel(
  value: string | null | undefined,
): value is TrackedContactChannel {
  return (
    !!value && (TRACKED_CONTACT_CHANNELS as readonly string[]).includes(value)
  );
}
