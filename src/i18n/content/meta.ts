import type { Locale } from '../config';

interface MetaText {
  title: string;
  description: string;
}

interface MetaTemplates {
  autopodbor: (location: string) => MetaText;
  vykup: (location: string) => MetaText;
  proverka: (location: string) => MetaText;
}

const ru: MetaTemplates = {
  autopodbor: (location) => ({
    title: `Автоподбор под ключ ${location}`,
    description: `Автоподбор под ключ ${location}: поиск, независимая проверка, сопровождение сделки и доставка до вашего города. Оставьте заявку — свяжемся в Telegram.`,
  }),
  vykup: (location) => ({
    title: `Выкуп авто ${location} на иностранных номерах — срочно`,
    description: `Срочный выкуп автомобилей ${location} на любых номерах — иностранных, российских или сербских. Оценка онлайн, оформление за 1 день, перевод в день сделки.`,
  }),
  proverka: (location) => ({
    title: `Проверка авто ${location} перед покупкой`,
    description: `Независимая проверка автомобиля ${location}. Выезд эксперта, осмотр кузова и ходовой, отчёт. Защитите себя от покупки битого авто.`,
  }),
};

const en: MetaTemplates = {
  autopodbor: (location) => ({
    title: `Full-Service Car Sourcing ${location}`,
    description: `Full-service car sourcing ${location}: search, independent inspection, deal support, and delivery to your city. Send a request — we'll reply on Telegram.`,
  }),
  vykup: (location) => ({
    title: `Urgent Car Buyout ${location} — Any Foreign Plates`,
    description: `Urgent car buyout ${location} — any plates: foreign, Russian, or Serbian. Online valuation, paperwork done in a day, payment the same day as the deal.`,
  }),
  proverka: (location) => ({
    title: `Pre-Purchase Car Inspection ${location}`,
    description: `Independent car inspection ${location}. An expert visits in person, checks the body and running gear, and sends a report. Protect yourself from buying a wrecked car.`,
  }),
};

const sr: MetaTemplates = {
  autopodbor: (location) => ({
    title: `Kompletan odabir vozila ${location}`,
    description: `Kompletan odabir vozila ${location}: pronalaženje, nezavisna provera, podrška tokom kupovine i dostava do vašeg grada. Pošaljite zahtev — javljamo se na Telegramu.`,
  }),
  vykup: (location) => ({
    title: `Hitan otkup vozila ${location} — strane tablice`,
    description: `Hitan otkup vozila ${location} na bilo kojim tablicama — stranim, ruskim ili srpskim. Procena onlajn, papirologija za 1 dan, isplata na dan dogovora.`,
  }),
  proverka: (location) => ({
    title: `Provera vozila pre kupovine ${location}`,
    description: `Nezavisna provera vozila ${location}. Stručnjak izlazi na teren, pregleda karoseriju i mehaniku, i šalje izveštaj. Zaštitite se od kupovine havarisanog vozila.`,
  }),
};

const templates: Record<Locale, MetaTemplates> = { ru, en, sr };

export function getMetaTemplates(locale: Locale): MetaTemplates {
  return templates[locale];
}
