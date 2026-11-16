import type { TrackedContactChannel } from './contactChannel.ts';

const LABELS: Record<TrackedContactChannel, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  phone: 'звонок',
};

export function channelLabel(channel: TrackedContactChannel): string {
  return LABELS[channel];
}
