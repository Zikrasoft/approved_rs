import type { Locale } from '@/i18n/config';

interface MetaText {
  title: string;
  description: string;
}

interface MetaTemplates {
  'vehicle-sourcing': (location: string) => MetaText;
  'vehicle-buyback': (location: string) => MetaText;
  'vehicle-inspection': (location: string) => MetaText;
}

const ru: MetaTemplates = {
  'vehicle-sourcing': (location) => ({
    title: `Автоподбор под ключ ${location}`,
    description: `Автоподбор под ключ ${location}: поиск, независимая проверка, сопровождение сделки и доставка до вашего города. Оставьте заявку — свяжемся в Telegram.`,
  }),
  'vehicle-buyback': (location) => ({
    title: `Выкуп авто ${location} на иностранных номерах — срочно`,
    description: `Срочный выкуп автомобилей ${location} на любых номерах — иностранных, российских или сербских. Оценка онлайн, оформление за 1 день, перевод в день сделки.`,
  }),
  'vehicle-inspection': (location) => ({
    title: `Проверка авто ${location} перед покупкой`,
    description: `Независимая проверка автомобиля ${location}. Выезд эксперта, осмотр кузова и ходовой, отчёт. Защитите себя от покупки битого авто.`,
  }),
};

const en: MetaTemplates = {
  'vehicle-sourcing': (location) => ({
    title: `Full-Service Car Sourcing ${location}`,
    description: `Full-service car sourcing ${location}: search, independent inspection, deal support, and delivery to your city. Send a request — we'll reply on Telegram.`,
  }),
  'vehicle-buyback': (location) => ({
    title: `Urgent Car Buyback ${location} — Any Foreign Plates`,
    description: `Urgent car buyback ${location} — any plates: foreign, Russian, or Serbian. Online valuation, paperwork done in a day, payment the same day as the deal.`,
  }),
  'vehicle-inspection': (location) => ({
    title: `Pre-Purchase Car Inspection ${location}`,
    description: `Independent car inspection ${location}. An expert visits in person, checks the body and running gear, and sends a report. Protect yourself from buying a wrecked car.`,
  }),
};

const sr: MetaTemplates = {
  'vehicle-sourcing': (location) => ({
    title: `Kompletan odabir vozila ${location}`,
    description: `Kompletan odabir vozila ${location}: pronalaženje, nezavisna provera, podrška tokom kupovine i dostava do vašeg grada. Pošaljite zahtev — javljamo se na Telegramu.`,
  }),
  'vehicle-buyback': (location) => ({
    title: `Hitan otkup vozila ${location} — strane tablice`,
    description: `Hitan otkup vozila ${location} na bilo kojim tablicama — stranim, ruskim ili srpskim. Procena onlajn, papirologija za 1 dan, isplata na dan dogovora.`,
  }),
  'vehicle-inspection': (location) => ({
    title: `Provera vozila pre kupovine ${location}`,
    description: `Nezavisna provera vozila ${location}. Stručnjak izlazi na teren, pregleda karoseriju i mehaniku, i šalje izveštaj. Zaštitite se od kupovine havarisanog vozila.`,
  }),
};

const es: MetaTemplates = {
  'vehicle-sourcing': (location) => ({
    title: `Búsqueda de Vehículos Llave en Mano ${location}`,
    description: `Búsqueda de vehículos llave en mano ${location}: localización, inspección independiente, gestión de la compra y entrega en tu ciudad. Envía tu solicitud — te contactamos por Telegram.`,
  }),
  'vehicle-buyback': (location) => ({
    title: `Compra Urgente de Coches ${location} — Cualquier Matrícula Extranjera`,
    description: `Compra urgente de coches ${location} con cualquier matrícula: extranjera, rusa o serbia. Valoración online, trámites en 1 día, pago el mismo día del acuerdo.`,
  }),
  'vehicle-inspection': (location) => ({
    title: `Inspección de Vehículos Antes de Comprar ${location}`,
    description: `Inspección independiente de vehículos ${location}. Visita de un experto, revisión de carrocería y mecánica, e informe. Protégete de comprar un coche accidentado.`,
  }),
};

const de: MetaTemplates = {
  'vehicle-sourcing': (location) => ({
    title: `Kompletter Fahrzeugankauf ${location}`,
    description: `Kompletter Fahrzeugankauf ${location}: Fahrzeugsuche, unabhängige Prüfung, Begleitung des Kaufs und Lieferung in Ihre Stadt. Senden Sie eine Anfrage — wir melden uns bei Telegram.`,
  }),
  'vehicle-buyback': (location) => ({
    title: `Dringender Autoankauf ${location} — Alle Ausländischen Kennzeichen`,
    description: `Dringender Autoankauf ${location} mit jedem Kennzeichen — ausländisch, russisch oder serbisch. Online-Bewertung, Abwicklung in 1 Tag, Auszahlung am Tag des Geschäfts.`,
  }),
  'vehicle-inspection': (location) => ({
    title: `Fahrzeugprüfung vor dem Kauf ${location}`,
    description: `Unabhängige Fahrzeugprüfung ${location}. Ein Experte vor Ort prüft Karosserie und Fahrwerk und erstellt einen Bericht. Schützen Sie sich vor dem Kauf eines Unfallwagens.`,
  }),
};

const templates: Record<Locale, MetaTemplates> = { ru, en, sr, es, de };

export function getMetaTemplates(locale: Locale): MetaTemplates {
  return templates[locale];
}
