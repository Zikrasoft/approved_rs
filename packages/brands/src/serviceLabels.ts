export const SERVICE_LABELS_RU = {
  'vehicle-sourcing': 'Автоподбор',
  'vehicle-buyback': 'Выкуп',
  'vehicle-inspection': 'Проверка',
  'vehicle-import': 'Привоз авто',
  'vehicle-import-de': 'Привоз из Германии',
  'vehicle-import-es': 'Привоз из Испании',
  'vehicle-import-ch': 'Привоз из Швейцарии',
  'vehicle-import-eu': 'Привоз из Европы',
  'vehicle-import-china': 'Привоз из Китая',

  diagnostics: 'Компьютерная диагностика',
  servicing: 'Плановое ТО',
  'brakes-suspension': 'Тормоза и подвеска',
  'engine-gearbox': 'Двигатель и коробка',
  'bodywork-painting': 'Кузов и покраска',
  'pre-purchase-inspection': 'Проверка перед покупкой',
  'parts-order': 'Заказ запчастей',

  'paint-protection-film': 'Защитная плёнка (PPF)',
  'colour-change-wrap': 'Смена цвета плёнкой',
  'polishing-ceramic': 'Полировка и керамика',
  'steering-wheel-restoration': 'Реставрация руля',

  'auto-service-belgrade': 'Автосервис',
  'detailing-belgrade': 'Детейлинг',

  'partner-carlab': 'Автосервис CarLab',
  'partner-details': 'Детейлинг Details',
} as const satisfies Record<string, string>;

export const PARTNER_SERVICE = {
  carlab: 'partner-carlab',
  details: 'partner-details',
} as const satisfies Record<string, keyof typeof SERVICE_LABELS_RU>;

export type PartnerService =
  (typeof PARTNER_SERVICE)[keyof typeof PARTNER_SERVICE];

export function isPartnerService(value: string): value is PartnerService {
  return (Object.values(PARTNER_SERVICE) as readonly string[]).includes(value);
}

export function serviceLabel(slug: string): string {
  return Object.hasOwn(SERVICE_LABELS_RU, slug)
    ? SERVICE_LABELS_RU[slug as keyof typeof SERVICE_LABELS_RU]
    : slug;
}
