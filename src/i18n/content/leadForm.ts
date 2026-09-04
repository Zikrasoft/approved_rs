import type { Locale } from '@/i18n/config';

interface LeadFormContent {
  headingLine1: string;
  headingEmphasis: string;
  subtext: string;
  nameLabel: string;
  namePlaceholder: string;
  contactLabel: string;
  telegramTab: string;
  whatsappTab: string;
  viberTab: string;
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
  whatsappTab: 'WhatsApp',
  viberTab: 'Viber',
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
  whatsappTab: 'WhatsApp',
  viberTab: 'Viber',
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
  whatsappTab: 'WhatsApp',
  viberTab: 'Viber',
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

const es: LeadFormContent = {
  headingLine1: 'Nos pondremos en contacto contigo',
  headingEmphasis: 'en menos de 2 horas',
  subtext: 'Consulta gratuita',
  nameLabel: 'Tu nombre',
  namePlaceholder: 'Juan',
  contactLabel: 'Cómo prefieres que te contactemos',
  telegramTab: 'Telegram',
  whatsappTab: 'WhatsApp',
  viberTab: 'Viber',
  phoneTab: 'Teléfono',
  commentLabel: 'Marca, modelo, presupuesto',
  commentPlaceholder: 'BMW Serie 3, 2020–2022, hasta 25.000 €…',
  consentBefore: 'Acepto la ',
  consentLinkText: 'política de privacidad',
  consentError: 'Tu consentimiento es necesario',
  submitLabel: 'Calcular el precio',
  errorNameRequired: 'Introduce tu nombre',
  errorTelegramRequired: 'Introduce tu Telegram',
  errorTelegramFormat: 'Formato: @usuario',
  errorPhoneRequired: 'Introduce tu número de teléfono',
  errorPhoneInvalid: 'Revisa tu número de teléfono',
};

const de: LeadFormContent = {
  headingLine1: 'Wir melden uns bei Ihnen',
  headingEmphasis: 'innerhalb von 2 Stunden',
  subtext: 'Kostenlose Beratung',
  nameLabel: 'Ihr Name',
  namePlaceholder: 'Max',
  contactLabel: 'Wie können wir Sie erreichen',
  telegramTab: 'Telegram',
  whatsappTab: 'WhatsApp',
  viberTab: 'Viber',
  phoneTab: 'Telefon',
  commentLabel: 'Marke, Modell, Budget',
  commentPlaceholder: 'BMW 3er, 2020–2022, bis 25.000 €…',
  consentBefore: 'Ich akzeptiere die ',
  consentLinkText: 'Datenschutzerklärung',
  consentError: 'Ihre Zustimmung ist erforderlich',
  submitLabel: 'Preis berechnen',
  errorNameRequired: 'Bitte geben Sie Ihren Namen ein',
  errorTelegramRequired: 'Bitte geben Sie Ihren Telegram-Namen ein',
  errorTelegramFormat: 'Format: @username',
  errorPhoneRequired: 'Bitte geben Sie Ihre Telefonnummer ein',
  errorPhoneInvalid: 'Bitte überprüfen Sie Ihre Telefonnummer',
};

const content: Record<Locale, LeadFormContent> = { ru, en, sr, es, de };

export function getLeadFormContent(locale: Locale): LeadFormContent {
  return content[locale];
}
