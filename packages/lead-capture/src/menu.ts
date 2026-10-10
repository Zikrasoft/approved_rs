import type { InlineKeyboardButton } from 'grammy/types';
import { escapeHtml } from '@podbor/lead-crm';
import type { CaptureCopy } from './copy.ts';

export interface ServiceCard {
  title: string;
  lines: string[];
  url: string;
}

export type MenuButton = {
  [K in keyof CaptureCopy]: CaptureCopy[K] extends { button: string }
    ? K
    : never;
}[keyof CaptureCopy];

export interface Screen {
  text: string;
  keyboard: InlineKeyboardButton[][];
}

export interface MenuConfig<L extends string, S extends string> {
  menu: readonly MenuButton[];
  services: readonly S[];
  serviceCard: (slug: S, locale: L) => ServiceCard;
  copy: (locale: L) => CaptureCopy;
}

export interface Tap {
  screen: string;
  locale: string;
  arg: string;
}

const TAP_PATTERN = /^([a-z]+):([a-z]{2})(?::([a-z0-9-]+))?$/;

export function tapData(screen: string, locale: string, arg?: string): string {
  return arg ? `${screen}:${locale}:${arg}` : `${screen}:${locale}`;
}

export function readTap(data: string): Tap | undefined {
  const match = TAP_PATTERN.exec(data);
  if (!match) return undefined;
  return { screen: match[1], locale: match[2], arg: match[3] ?? '' };
}

export function createScreens<L extends string, S extends string>({
  menu,
  services,
  serviceCard,
  copy,
}: MenuConfig<L, S>) {
  const isService = (value: string): value is S =>
    (services as readonly string[]).includes(value);

  const tap = (
    text: string,
    screen: string,
    locale: L,
    arg?: string,
  ): InlineKeyboardButton[] => [
    { text, callback_data: tapData(screen, locale, arg) },
  ];

  function mainMenu(locale: L): Screen {
    const words = copy(locale);
    return {
      text: words.menu.text,
      keyboard: menu.map((id) => tap(words[id].button, id, locale)),
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

  const screens: Record<string, (locale: L, arg: string) => Screen | null> = {
    menu: mainMenu,
    services: serviceList,
    service: (locale, slug) => (isService(slug) ? service(locale, slug) : null),
  };

  function render(screen: string, locale: L, arg: string): Screen | null {
    return Object.hasOwn(screens, screen) ? screens[screen](locale, arg) : null;
  }

  function servicePicker(locale: L): InlineKeyboardButton[][] {
    return services.map((slug) =>
      tap(serviceCard(slug, locale).title, 'pick', locale, slug),
    );
  }

  return { isService, mainMenu, service, render, servicePicker };
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
