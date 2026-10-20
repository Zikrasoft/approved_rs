import type { TrackedContactChannel } from '@podbor/lead-crm/contact-channel';
import { CONTACT_PLACEMENT_ATTRIBUTE, type ContactPlacement } from './goals.ts';
import {
  captureBotLink,
  phoneLink,
  telegramLink,
  viberLink,
  whatsappLink,
} from './contactLinks.ts';

export type BrandContacts = {
  phone: string;
  whatsapp: string;
  viber: string;
  captureBot: string;
  humanTelegram?: string;
  prefill?: (locale: string, service?: string) => string | undefined;
};

export type ContactControlRequest = {
  channel: TrackedContactChannel;
  onThanks: boolean;
  manager?: boolean;
  region?: 'contacts';
  locale: string;
  service?: string;
};

export type ContactControl = {
  href: string;
  attrs: Record<string, string>;
  pointer: 'any' | 'coarse-only';
  plainNumber?: string;
};

const MESSENGER_ATTRS = { target: '_blank', rel: 'noopener' };

export const TELEGRAM_CHOICE_ATTRIBUTE = 'data-telegram-choice';

export const TELEGRAM_CHOICE_SELECTOR = `[${TELEGRAM_CHOICE_ATTRIBUTE}]`;

export const createContactControls =
  (brand: BrandContacts) =>
  ({
    channel,
    onThanks,
    manager,
    region,
    locale,
    service,
  }: ContactControlRequest): ContactControl => {
    const channelAttr = { 'data-contact-channel': channel };
    if (channel === 'phone')
      return {
        href: phoneLink(brand.phone),
        attrs: channelAttr,
        pointer: 'coarse-only',
        ...(onThanks && region === 'contacts' && { plainNumber: brand.phone }),
      };

    const attrs = { ...channelAttr, ...MESSENGER_ATTRS };
    const pointer = 'any';
    if (channel === 'telegram') {
      const bot = captureBotLink(brand.captureBot, locale, service);
      if (!brand.humanTelegram) return { href: bot, attrs, pointer };
      const human = telegramLink(brand.humanTelegram);
      if (onThanks || manager) return { href: human, attrs, pointer };
      return {
        href: bot,
        attrs: { ...attrs, [TELEGRAM_CHOICE_ATTRIBUTE]: human },
        pointer,
      };
    }
    const href = {
      whatsapp: () =>
        whatsappLink(brand.whatsapp, brand.prefill?.(locale, service)),
      viber: () => viberLink(brand.viber),
    }[channel]();
    return { href, attrs, pointer };
  };

const IN_FLOW_PLACEMENTS: readonly ContactPlacement[] = [
  'hero',
  'bar',
  'thanks',
];

const CONTACT_CTA_ATTRIBUTE = 'data-contact-cta';

export const CONTACT_CTA_SELECTOR = `[${CONTACT_CTA_ATTRIBUTE}]`;

export const contactCta = { [CONTACT_CTA_ATTRIBUTE]: '' };

export const contactRegion = (placement: ContactPlacement) => ({
  [CONTACT_PLACEMENT_ATTRIBUTE]: placement,
  ...(IN_FLOW_PLACEMENTS.includes(placement) && contactCta),
});
