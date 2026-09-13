export const SERVICE_LABELS_RU: Record<string, string> = {
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
};

export function serviceLabel(slug: string): string {
  return SERVICE_LABELS_RU[slug] ?? slug;
}
