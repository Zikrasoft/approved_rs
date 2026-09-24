import type { TrackedContactChannel } from './contactChannel.ts';

const LABELS: Record<TrackedContactChannel, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  phone: 'звонок',
};

export function channelLabel(channel: string): string {
  return Object.hasOwn(LABELS, channel)
    ? LABELS[channel as TrackedContactChannel]
    : channel;
}
