import type { Locale } from '../config';

interface LeadFormContent {
  headingLine1: string;
  headingEmphasis: string;
  subtext: string;
  nameLabel: string;
  namePlaceholder: string;
  contactLabel: string;
  telegramTab: string;
  phoneTab: string;
  commentLabel: string;
  commentPlaceholder: string;
  consentBefore: string;
  consentLinkText: string;
  consentError: string;
  submitLabel: string;
  errorNameRequired: string;
  errorTelegramRequired: string;
  errorTelegramFormat: string;
  errorPhoneRequired: string;
  errorPhoneInvalid: string;
}

const ru: LeadFormContent = {
  headingLine1: 'Свяжемся с вами',
  headingEmphasis: 'в течение 2 часов',
  subtext: 'Бесплатная консультация',
  nameLabel: 'Ваше имя',
  namePlaceholder: 'Иван',
  contactLabel: 'Как с вами связаться',
  telegramTab: 'Telegram',
  phoneTab: 'Телефон',
  commentLabel: 'Марка, модель, бюджет',
  commentPlaceholder: 'BMW 3, 2020–2022, до €25 000…',
  consentBefore: 'Согласен с ',
  consentLinkText: 'политикой конфиденциальности',
  consentError: 'Необходимо ваше согласие',
  submitLabel: 'Рассчитать стоимость',
  errorNameRequired: 'Введите ваше имя',
  errorTelegramRequired: 'Введите Telegram',
  errorTelegramFormat: 'Формат: @username',
  errorPhoneRequired: 'Введите номер телефона',
  errorPhoneInvalid: 'Проверьте номер телефона',
};

const en: LeadFormContent = {
  headingLine1: "We'll be in touch",
  headingEmphasis: 'within 2 hours',
  subtext: 'Free consultation',
  nameLabel: 'Your name',
  namePlaceholder: 'John',
  contactLabel: 'How to reach you',
  telegramTab: 'Telegram',
  phoneTab: 'Phone',
  commentLabel: 'Make, model, budget',
  commentPlaceholder: 'BMW 3, 2020–2022, up to €25,000…',
  consentBefore: 'I agree to the ',
  consentLinkText: 'privacy policy',
  consentError: 'Your consent is required',
  submitLabel: 'Get a Quote',
  errorNameRequired: 'Enter your name',
  errorTelegramRequired: 'Enter your Telegram',
  errorTelegramFormat: 'Format: @username',
  errorPhoneRequired: 'Enter your phone number',
  errorPhoneInvalid: 'Check your phone number',
};

const sr: LeadFormContent = {
  headingLine1: 'Javljamo vam se',
  headingEmphasis: 'u roku od 2 sata',
  subtext: 'Besplatna konsultacija',
  nameLabel: 'Vaše ime',
  namePlaceholder: 'Marko',
  contactLabel: 'Kako da vas kontaktiramo',
  telegramTab: 'Telegram',
  phoneTab: 'Telefon',
  commentLabel: 'Marka, model, budžet',
  commentPlaceholder: 'BMW 3, 2020–2022, do €25.000…',
  consentBefore: 'Slažem se sa ',
  consentLinkText: 'politikom privatnosti',
  consentError: 'Vaša saglasnost je obavezna',
  submitLabel: 'Zatražite procenu',
  errorNameRequired: 'Unesite svoje ime',
  errorTelegramRequired: 'Unesite Telegram',
  errorTelegramFormat: 'Format: @username',
  errorPhoneRequired: 'Unesite broj telefona',
  errorPhoneInvalid: 'Proverite broj telefona',
};

const content: Record<Locale, LeadFormContent> = { ru, en, sr };

export function getLeadFormContent(locale: Locale): LeadFormContent {
  return content[locale];
}
