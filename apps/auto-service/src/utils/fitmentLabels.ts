import { translated, type Fitment } from '@podbor/catalog-contract';
import type { Locale } from '@/i18n/config';
import { content } from '@/i18n/content';

type Fit = Pick<
  Fitment,
  | 'quantity'
  | 'axle'
  | 'side'
  | 'production_from'
  | 'production_to'
  | 'gearbox'
  | 'steering'
  | 'note'
  | 'translations'
>;

const monthYear = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));

export const fitQuantity = (fit: Fit, locale: Locale): string =>
  content(locale).partsCar.fitment.quantity.replace(
    '{count}',
    String(fit.quantity),
  );

export function fitPosition(fit: Fit, locale: Locale): string {
  const copy = content(locale).partsCar.fitment;
  return [fit.axle && copy.axle[fit.axle], fit.side && copy.side[fit.side]]
    .filter(Boolean)
    .join(', ');
}

export function fitConditions(fit: Fit, locale: Locale): string[] {
  const { fitment: copy, car } = content(locale).partsCar;
  return [
    fit.steering && copy.steering.replace('{side}', car.steering[fit.steering]),
    fit.gearbox && copy.gearbox[fit.gearbox],
    fit.production_from &&
      copy.builtFrom.replace('{date}', monthYear(fit.production_from, locale)),
    fit.production_to &&
      copy.builtTo.replace('{date}', monthYear(fit.production_to, locale)),
  ].filter((condition): condition is string => Boolean(condition));
}

export const fitNote = (fit: Fit, locale: Locale): string | null =>
  fit.note
    ? translated(
        { note: fit.note, translations: fit.translations },
        'note',
        locale,
      )
    : null;
