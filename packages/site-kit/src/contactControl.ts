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
  placement: ContactPlacement;
  onThanks: boolean;
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

export const createContactControls =
  (brand: BrandContacts) =>
  ({
    channel,
    placement,
    onThanks,
    locale,
    service,
  }: ContactControlRequest): ContactControl => {
    const channelAttr = { 'data-contact-channel': channel };
    if (channel === 'phone')
      return {
        href: phoneLink(brand.phone),
        attrs: channelAttr,
        pointer: 'coarse-only',
        ...(placement === 'thanks' && { plainNumber: brand.phone }),
      };

    const href = {
      whatsapp: () =>
        whatsappLink(brand.whatsapp, brand.prefill?.(locale, service)),
      viber: () => viberLink(brand.viber),
      telegram: () =>
        onThanks && brand.humanTelegram
          ? telegramLink(brand.humanTelegram)
          : captureBotLink(brand.captureBot, locale, service),
    }[channel]();
    return {
      href,
      attrs: { ...channelAttr, ...MESSENGER_ATTRS },
      pointer: 'any',
    };
  };

const IN_FLOW_PLACEMENTS: readonly ContactPlacement[] = [
  'hero',
  'bar',
  'thanks',
];

export const contactRegion = (placement: ContactPlacement) => ({
  [CONTACT_PLACEMENT_ATTRIBUTE]: placement,
  ...(IN_FLOW_PLACEMENTS.includes(placement) && { 'data-contact-cta': '' }),
});
