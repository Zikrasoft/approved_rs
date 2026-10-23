const DAY_WORDS: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: 'день',
  few: 'дня',
  many: 'дней',
};

export const dayWord = (days: number): string =>
  DAY_WORDS[new Intl.PluralRules('ru').select(days)] ?? 'дня';

export const PARTS_ORDER_COPY = {
  heading: (displayId: number) =>
    `Заказ #${displayId}, самовывоз, оплата при получении`,
  confirm: 'Нужно подтвердить наличие и время самовывоза',
  line: (title: string, quantity: number, sum: string) =>
    `${title} × ${quantity}: ${sum}`,
  inStock: 'в наличии',
  pickupIn: (days: number) => `забрать через ${days} ${dayWord(days)}`,
  addon: (title: string, sum: string) => `+ ${title}: ${sum}`,
  total: (sum: string) => `Итого: ${sum}`,
  leftOut: (count: number) => `Не поместилось позиций: ${count}`,
  undelivered: (order: number | string, reason: string) =>
    `Заказ #${order} не дошел до CRM после всех попыток. Найдите его в админке магазина и свяжитесь с клиентом. Причина: ${reason}`,
};
