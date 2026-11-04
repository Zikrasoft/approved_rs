import type { TranslatableLocale } from './config';

export const TARGET_LANGUAGE_NAME: Record<TranslatableLocale, string> = {
  sr: 'Serbian (Latin script)',
  en: 'English',
};

export const LOCALE_GUIDANCE: Partial<Record<TranslatableLocale, string>> = {
  sr:
    'A waiting time is "za": "через {days}" and "забрать через {days}" become "za {days}" and ' +
    '"preuzimanje za {days}", a bare "Через" before a number of days is "Za", never "kroz". ' +
    'Mind the case after "u": "в корзине" (where) is "u korpi", "в корзину" (where to) is "u korpu". ' +
    'Address the visitor formally everywhere, buttons included: "Pošaljite", "Proverite", "Dodajte", ' +
    '"Nastavite", never "Pošalji", "Proveri", "Dodaj", "Nastavi". The person at CarLab the visitor deals ' +
    'with (менеджер, консультант, продавец, наша команда) is always "saradnik". "Заявка" is "upit", never ' +
    '"zahtev". "(необязательно)" is "(nije obavezno)", never "opciono". Decline the brand inside a ' +
    'sentence: "u CarLabu", "iz CarLaba"; a title keeps " | CarLab" as it is. ' +
    '"Автосервис" is "auto servis" and "автозапчасти" is "auto delovi", two words as on the CarLab ' +
    'sign, declined normally ("u auto servisu", "auto delova"), never "auto-servis", "autoservis" ' +
    'or "auto-delovi".',
  en:
    'Write interface labels and headings the way an English shop would, in sentence case: ' +
    '"Подходит для автомобилей" is "Fits these cars", never "Fits for Vehicles". ' +
    '"Корзина" is always "cart", never "basket": "Add to cart", "In cart", "View cart", "Adding to cart…". ' +
    '"Заявка" is always "enquiry", never "inquiry". "{count} шт." is "{count} pc" for one item and ' +
    '"{count} pcs" for several. "Ищу: {q}", the visitor\'s own message to us, is "Looking for: {q}".',
};

export const BUSINESS_DESCRIPTION =
  'CarLab, an independent car service in Belgrade, Serbia — diagnostics, servicing, brakes and suspension, engine and gearbox work, accident repair and respraying, plus a parts counter selling car batteries';
