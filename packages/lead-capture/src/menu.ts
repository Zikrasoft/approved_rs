import type { InlineKeyboardButton } from 'grammy/types';
import { z } from 'zod';
import { escapeHtml } from '@podbor/lead-crm';
import { formatPhone } from '@podbor/site-kit/format-phone';
import { captureBotLink, telegramLink } from '@podbor/site-kit/contact-links';
import type { CaptureCopy } from './copy.ts';

export interface ServiceCard {
  title: string;
  lines: string[];
  url: string;
}

export type MenuButton = {
  [K in keyof CaptureCopy]-?: CaptureCopy[K] extends { button: string }
    ? K
    : never;
}[keyof CaptureCopy];

export interface Screen {
  text: string;
  keyboard: InlineKeyboardButton[][];
}

export interface Venue {
  title: string;
  street: string;
  city: string;
  lat: number;
  lon: number;
}

export interface Contacts {
  phone: string;
  site: string;
  venue?: Venue;
}

export interface PartnerBot {
  name: string;
  url: string;
}

export interface MenuConfig<L extends string, S extends string> {
  menu: readonly MenuButton[];
  contacts: Contacts;
  services: readonly S[];
  serviceCard: (slug: S, locale: L) => ServiceCard;
  copy: (locale: L) => CaptureCopy;
  partners?: (locale: L) => readonly PartnerBot[];
  languages: Readonly<Record<L, string>>;
  humanTelegram?: string;
}

export const REFERRAL = 'from-approved';

export function referralLink(botUsername: string, locale: string): string {
  return captureBotLink(botUsername, locale, REFERRAL);
}

export interface Tap {
  screen: string;
  locale: string;
  arg: string;
}

export const LANGUAGE_SWITCH_TAP = 'locale';

const LOCALE_FLAGS: Readonly<Record<string, string>> = {
  ru: '🇷🇺',
  sr: '🇷🇸',
  en: '🇬🇧',
  es: '🇪🇸',
  de: '🇩🇪',
};

const flagOf = (locale: string): string => LOCALE_FLAGS[locale] ?? '🏳️';

export const SERVICES_DONE_TAP = 'done';

export const MANAGER_TAP = 'manager';

const TAP_STYLES = new Map<string, 'success' | 'primary'>([
  ['request', 'success'],
  [SERVICES_DONE_TAP, 'success'],
  [MANAGER_TAP, 'primary'],
]);

const TAP_PATTERN = /^([a-z]+):([a-z]{2})(?::([a-z0-9-]+))?$/;

export function tapData(screen: string, locale: string, arg?: string): string {
  return arg ? `${screen}:${locale}:${arg}` : `${screen}:${locale}`;
}

export const tapSchema = z
  .string()
  .regex(TAP_PATTERN)
  .transform((data): Tap => {
    const [screen = '', locale = '', arg = ''] = data.split(':');
    return { screen, locale, arg };
  })
  .optional()
  .catch(undefined);

export function createScreens<L extends string, S extends string>({
  menu,
  services,
  serviceCard,
  copy,
  contacts,
  partners,
  languages,
  humanTelegram,
}: MenuConfig<L, S>) {
  const isService = (value: string): value is S =>
    (services as readonly string[]).includes(value);

  const tap = (
    text: string,
    screen: string,
    locale: L,
    arg?: string,
  ): InlineKeyboardButton[] => {
    const style = TAP_STYLES.get(screen);
    return [
      {
        text,
        callback_data: tapData(screen, locale, arg),
        ...(style && { style }),
      },
    ];
  };

  const served = Object.keys(languages) as L[];
  const languageButton = `🌐 ${served.map(flagOf).join(' ')}`;

  function mainMenu(locale: L): Screen {
    const words = copy(locale);
    const label = (id: MenuButton) =>
      id === 'language' ? languageButton : words[id].button;
    return {
      text: words.menu.text,
      keyboard: menu.map((id) => tap(label(id), id, locale)),
    };
  }

  function serviceList(locale: L): Screen {
    const words = copy(locale);
    return {
      text: words.services.text,
      keyboard: [
        ...services.map((slug) =>
          tap(serviceCard(slug, locale).title, 'service', locale, slug),
        ),
        tap(words.menu.back, 'menu', locale),
      ],
    };
  }

  function service(locale: L, slug: S): Screen {
    const words = copy(locale);
    const card = serviceCard(slug, locale);
    return {
      text: [
        `<b>${escapeHtml(card.title)}</b>`,
        '',
        ...card.lines.map(escapeHtml),
      ].join('\n'),
      keyboard: [
        tap(words.card.request, 'request', locale, slug),
        [{ text: words.card.site, url: card.url }],
        tap(words.menu.back, 'services', locale),
      ],
    };
  }

  function contactsScreen(locale: L): Screen {
    const words = copy(locale);
    return {
      text: [
        words.contacts.text,
        '',
        words.contacts.hours,
        formatPhone(contacts.phone),
        contacts.site,
      ].join('\n'),
      keyboard: [tap(words.menu.back, 'menu', locale)],
    };
  }

  function manager(locale: L): Screen {
    const words = copy(locale);
    const back = tap(words.menu.back, 'menu', locale);
    if (!humanTelegram) return { text: words.manager.text, keyboard: [back] };
    return {
      text: words.manager.handoff,
      keyboard: [
        [{ text: words.manager.chat, url: telegramLink(humanTelegram) }],
        back,
      ],
    };
  }

  function partnerList(locale: L): Screen | null {
    if (!partners) return null;
    const words = copy(locale);
    return {
      text: words.partners.text,
      keyboard: [
        ...partners(locale).map(({ name, url }) => [{ text: name, url }]),
        tap(words.menu.back, 'menu', locale),
      ],
    };
  }

  function languagePicker(locale: L): Screen {
    const words = copy(locale);
    return {
      text: words.language.text,
      keyboard: [
        ...served.map((code) =>
          tap(`${flagOf(code)} ${languages[code]}`, LANGUAGE_SWITCH_TAP, code),
        ),
        tap(words.menu.back, 'menu', locale),
      ],
    };
  }

  const screens: Record<string, (locale: L, arg: string) => Screen | null> = {
    menu: mainMenu,
    services: serviceList,
    service: (locale, slug) => (isService(slug) ? service(locale, slug) : null),
    [MANAGER_TAP]: manager,
    partners: partnerList,
    language: languagePicker,
  };

  function render(screen: string, locale: L, arg: string): Screen | null {
    return Object.hasOwn(screens, screen) ? screens[screen](locale, arg) : null;
  }

  function servicePicker(
    locale: L,
    picked: readonly string[],
  ): InlineKeyboardButton[][] {
    const { request } = copy(locale);
    return [
      ...services.map((slug) => {
        const { title } = serviceCard(slug, locale);
        const label = picked.includes(slug) ? `✅ ${title}` : title;
        return tap(label, 'pick', locale, slug);
      }),
      tap(
        services.some((slug) => picked.includes(slug))
          ? request.done
          : request.unsure,
        SERVICES_DONE_TAP,
        locale,
      ),
    ];
  }

  return {
    isService,
    mainMenu,
    service,
    contactsScreen,
    render,
    servicePicker,
    languagePicker,
  };
}

export interface ServiceSpecs {
  name: string;
  short: string;
  priceFrom: string;
  duration: string;
  includesHeading: string;
  includes: string[];
}

export interface ServiceSpecsLabels {
  specsPriceLabel: string;
  specsDurationLabel: string;
}

export function specsCard(
  labels: ServiceSpecsLabels,
  service: ServiceSpecs,
  url: string,
): ServiceCard {
  return {
    title: service.name,
    lines: [
      service.short,
      '',
      `${labels.specsPriceLabel}: ${service.priceFrom}`,
      `${labels.specsDurationLabel}: ${service.duration}`,
      '',
      `${service.includesHeading}:`,
      ...service.includes.map((item) => `• ${item}`),
    ],
    url,
  };
}
