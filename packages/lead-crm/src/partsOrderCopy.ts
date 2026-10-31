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
  manualOffer: 'ручное предложение',
  pickupIn: (days: number) =>
    days === 1 ? 'забрать завтра' : `забрать через ${days} ${dayWord(days)}`,
  addon: (title: string, sum: string) => `+ ${title}: ${sum}`,
  installation: 'Установка в сервисе CarLab',
  free: 'бесплатно',
  total: (sum: string) => `Итого: ${sum}`,
  leftOut: (count: number, orderUrl: string) =>
    `Не поместилось позиций: ${count}, весь заказ: ${orderUrl}`,
  notPlaced: (reason: string) =>
    `Заказ не оформлен: ${reason}. Свяжитесь с клиентом`,
  notPlacedReason: {
    price: 'цена изменилась',
    stock: 'позиции нет в нужном количестве',
    offer: 'позицию больше не продают',
    contact: 'магазин не принял контакт',
    cart: 'корзина изменилась в другой вкладке',
    expired: 'корзина устарела',
    unreachable: 'магазин не ответил',
  },
  notPlacedLeftOut: (count: number) => `Не поместилось позиций: ${count}`,
  undelivered: (order: number | string, reason: string) =>
    `Заказ #${order} не дошел до CRM после всех попыток. Найдите его в админке магазина и свяжитесь с клиентом. Причина: ${reason}`,
  cancelUndelivered: (order: number | string, reason: string) =>
    `Заказ #${order} отменен в магазине, но CRM не отметила его Лид после всех попыток. Отметьте Лид ❌ сами. Причина: ${reason}`,
};

export type NotPlacedReason = keyof typeof PARTS_ORDER_COPY.notPlacedReason;

export const orderMoney = (amount: number, currency: string): string =>
  `${amount.toLocaleString('ru-RU')} ${currency.toUpperCase()}`;

export type OrderLine = {
  title: string;
  quantity: number;
  unitPrice: number;
  addon: boolean;
  inStock?: boolean | null;
  leadTimeDays?: number | null;
  source?: string | null;
};

export function orderLineText(line: OrderLine, currency: string): string {
  const sum = orderMoney(line.unitPrice * line.quantity, currency);
  if (line.addon)
    return PARTS_ORDER_COPY.addon(
      line.title,
      line.unitPrice === 0 ? PARTS_ORDER_COPY.free : sum,
    );
  const readiness = [
    line.inStock && PARTS_ORDER_COPY.inStock,
    line.leadTimeDays && PARTS_ORDER_COPY.pickupIn(line.leadTimeDays),
    line.source,
  ]
    .filter(Boolean)
    .join(', ');
  const text = PARTS_ORDER_COPY.line(line.title, line.quantity, sum);
  return readiness ? `${text}, ${readiness}` : text;
}
