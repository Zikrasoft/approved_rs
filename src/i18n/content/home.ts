import type { Locale } from '@/i18n/config';

interface JourneyStep {
  title: string;
  desc: string;
  note?: string;
}

interface TrustCard {
  title: string;
  text: string;
}

interface Testimonial {
  quote: string;
  name: string;
  caption: string;
}

interface StatItem {
  value: string;
  label: string;
}

interface HomeContent {
  metaTitle: string;
  metaDescription: string;
  journey: [JourneyStep, JourneyStep, JourneyStep, JourneyStep];
  heroEyebrow: string;
  heroLine1: string;
  heroLine2: string;
  heroLine3: string;
  stampText: string;
  heroSubtext: string;
  statClients: StatItem;
  statCountries: StatItem;
  statYears: StatItem;
  journeyHeading: string;
  journeySubtext: string;
  journeyMoreLabel: string;
  countryStripLabel: string;
  latestCasesHeading: string;
  whyUsHeading: string;
  whyUsSubtext: string;
  trustCards: [TrustCard, TrustCard, TrustCard];
  testimonialsHeading: string;
  testimonials: [Testimonial, Testimonial, Testimonial];
  ctaEyebrow: string;
  ctaHeading: { line1: string; line2: string; accentWord: string };
  ctaSubtext: string;
  ctaTelegramLabel: string;
  ctaStatClients: StatItem;
  ctaStatCountries: StatItem;
  ctaStatYears: StatItem;
  ctaStatResponse: StatItem;
}

const ru: HomeContent = {
  metaTitle: 'Автоподбор и доставка авто из Европы',
  metaDescription: 'Подберём и привезём автомобиль из Германии, Испании, Сербии и Швейцарии. Проверка, выкуп, доставка. Работаем для русскоязычных по всему миру.',
  journey: [
    { title: 'Подбор', desc: 'Находим, проверяем и доставляем автомобиль под ваш бюджет — под ключ, в Германии, Испании, Сербии и Швейцарии.' },
    { title: 'Проверка', desc: 'Независимый эксперт осматривает автомобиль перед покупкой — по 100+ пунктам с видео.', note: 'Нашли машину сами? Закажем проверку отдельно' },
    { title: 'Выкуп', desc: 'Оформляем выкуп и растаможку автомобиля на иностранных номерах.', note: 'Машина уже за границей? Поможем её оформить' },
    { title: 'Автосервис', desc: 'Ремонт и обслуживание автомобиля в Белграде — с гарантией качества.', note: 'Машина уже ваша? Тоже беремся' },
  ],
  heroEyebrow: 'Один путь: авто из Европы',
  heroLine1: 'Найдено.',
  heroLine2: 'Проверено.',
  heroLine3: 'Одобрено.',
  stampText: 'ПРОВЕРЕНО · ОДОБРЕНО · ПРОВЕРЕНО · ОДОБРЕНО ·',
  heroSubtext: 'Подберём, проверим, оформим и привезём автомобиль из Германии, Испании или Сербии — а потом обслужим его в своём автосервисе. Один путь, одна команда.',
  statClients: { value: '200+', label: 'клиентов' },
  statCountries: { value: '4', label: 'страны' },
  statYears: { value: '5 лет', label: 'на рынке' },
  journeyHeading: 'Один путь: от поиска до сервиса',
  journeySubtext: 'Автоподбор, проверка, выкуп и автосервис — не 4 разных услуги, а этапы одного пути вашего автомобиля. Войти можно с любого шага.',
  journeyMoreLabel: 'Подробнее',
  countryStripLabel: 'Автоподбор по странам:',
  latestCasesHeading: 'Последние кейсы',
  whyUsHeading: 'Почему выбирают нас',
  whyUsSubtext: 'Покупка авто из другой страны вызывает вопросы. Вот как мы их снимаем.',
  trustCards: [
    { title: 'Полная прозрачность', text: 'Высылаем подробный чек-лист (100+ пунктов) и видео каждого нюанса: кузов, салон, ходовая. Вы видите автомобиль так, как будто стоите рядом.' },
    { title: 'Безопасность сделки', text: 'Поэтапная оплата и понятные условия. Сопровождаем документы на всех этапах: оформление, растаможка, регистрация — без сюрпризов.' },
    { title: 'Локальная экспертиза', text: 'Знаем специфику каждого рынка: автобанные пробеги Германии, особенности кузова испанских авто, нюансы оформления на иностранные номера в Сербии.' },
  ],
  testimonialsHeading: 'Что говорят клиенты',
  testimonials: [
    { quote: '«Привезли BMW 3 серии из Мюнхена в Белград. Всё чётко — от осмотра до постановки на учёт. Сэкономили кучу нервов на оформлении.»', name: 'Александр', caption: 'BMW 320d, Германия → Сербия' },
    { quote: '«Долго искал Skoda Octavia в хорошем состоянии. Ребята нашли вариант в Испании, проверили независимым экспертом — всё совпало с описанием.»', name: 'Михаил', caption: 'Skoda Octavia, Испания → Россия' },
    { quote: '«Оформление на иностранные номера казалось сложным. Команда провела через каждый шаг — и через месяц я уже ездил. Рекомендую.»', name: 'Дмитрий', caption: 'VW Passat, Германия → Сербия' },
  ],
  ctaEyebrow: 'Готовы начать?',
  ctaHeading: { line1: 'Расскажите нам', line2: 'о своём', accentWord: 'автомобиле' },
  ctaSubtext: 'Отвечаем в течение 2 часов. Консультация бесплатна.',
  ctaTelegramLabel: 'Написать в Telegram',
  ctaStatClients: { value: '200+', label: 'клиентов' },
  ctaStatCountries: { value: '4', label: 'страны' },
  ctaStatYears: { value: '5 лет', label: 'опыт' },
  ctaStatResponse: { value: '2 ч', label: 'ответ' },
};

const en: HomeContent = {
  metaTitle: 'Car Sourcing and Delivery from Europe',
  metaDescription: 'We source and deliver cars from Germany, Spain, Serbia, and Switzerland. Inspection, buyout, delivery. Serving Russian-speaking clients worldwide.',
  journey: [
    { title: 'Sourcing', desc: 'We find, inspect, and deliver a car that fits your budget — fully turnkey, in Germany, Spain, Serbia, and Switzerland.' },
    { title: 'Inspection', desc: 'An independent expert inspects the car before purchase — 100+ checkpoints, with video.', note: 'Already found a car yourself? We can inspect it separately' },
    { title: 'Buyout', desc: 'We handle the buyout and customs clearance for cars on foreign plates.', note: "Already have the car abroad? We'll help register it" },
    { title: 'Auto Service', desc: 'Car repair and maintenance in Belgrade — with a quality guarantee.', note: 'Already own the car? We handle that too' },
  ],
  heroEyebrow: 'One path: cars from Europe',
  heroLine1: 'Found.',
  heroLine2: 'Inspected.',
  heroLine3: 'Approved.',
  stampText: 'INSPECTED · APPROVED · INSPECTED · APPROVED ·',
  heroSubtext: 'We source, inspect, register, and deliver your car from Germany, Spain, or Serbia — then service it at our own shop. One path, one team.',
  statClients: { value: '200+', label: 'clients' },
  statCountries: { value: '4', label: 'countries' },
  statYears: { value: '5 yrs', label: 'on the market' },
  journeyHeading: 'One Path: From Search to Service',
  journeySubtext: "Sourcing, inspection, buyout, and auto service aren't 4 separate services — they're stages of one journey for your car. Jump in at any step.",
  journeyMoreLabel: 'Learn more',
  countryStripLabel: 'Car sourcing by country:',
  latestCasesHeading: 'Latest Cases',
  whyUsHeading: 'Why Choose Us',
  whyUsSubtext: "Buying a car from another country raises questions. Here's how we address them.",
  trustCards: [
    { title: 'Full Transparency', text: 'We send a detailed checklist (100+ points) and video of every detail: body, interior, running gear. You see the car as if you were standing right there.' },
    { title: 'Deal Security', text: 'Staged payments and clear terms. We support the paperwork at every stage — registration, customs, plates — no surprises.' },
    { title: 'Local Expertise', text: "We know the specifics of every market: German autobahn mileage patterns, Spanish cars' body quirks, the nuances of registering foreign plates in Serbia." },
  ],
  testimonialsHeading: 'What Clients Say',
  testimonials: [
    { quote: '"They brought a BMW 3 Series from Munich to Belgrade. Everything was precise — from the inspection to registration. Saved me a ton of hassle with the paperwork."', name: 'Александр', caption: 'BMW 320d, Germany → Serbia' },
    { quote: '"I\'d been searching for a Škoda Octavia in good condition for a while. They found one in Spain and had an independent expert check it — everything matched the description."', name: 'Михаил', caption: 'Škoda Octavia, Spain → Russia' },
    { quote: '"Registering foreign plates seemed complicated. The team walked me through every step — a month later I was driving. Recommended."', name: 'Дмитрий', caption: 'VW Passat, Germany → Serbia' },
  ],
  ctaEyebrow: 'Ready to start?',
  ctaHeading: { line1: 'Tell us', line2: 'about your', accentWord: 'car' },
  ctaSubtext: 'We reply within 2 hours. Consultation is free.',
  ctaTelegramLabel: 'Message on Telegram',
  ctaStatClients: { value: '200+', label: 'clients' },
  ctaStatCountries: { value: '4', label: 'countries' },
  ctaStatYears: { value: '5 yrs', label: 'experience' },
  ctaStatResponse: { value: '2 hrs', label: 'response' },
};

const sr: HomeContent = {
  metaTitle: 'Odabir i dostava vozila iz Evrope',
  metaDescription: 'Pronalazimo i dovozimo vozila iz Nemačke, Španije, Srbije i Švajcarske. Provera, otkup, dostava. Radimo za ruskojezično tržište širom sveta.',
  journey: [
    { title: 'Odabir', desc: 'Pronalazimo, proveravamo i dovozimo vozilo prema vašem budžetu — sve na ključ, u Nemačkoj, Španiji, Srbiji i Švajcarskoj.' },
    { title: 'Provera', desc: 'Nezavisni stručnjak pregleda vozilo pre kupovine — po više od 100 stavki, sa video snimkom.', note: 'Sami ste pronašli vozilo? Proveru radimo i posebno' },
    { title: 'Otkup', desc: 'Sređujemo otkup i carinjenje vozila na stranim tablicama.', note: 'Vozilo je već u inostranstvu? Pomažemo da ga registrujete' },
    { title: 'Auto servis', desc: 'Popravka i održavanje vozila u Beogradu — uz garanciju kvaliteta.', note: 'Vozilo je već vaše? I to radimo' },
  ],
  heroEyebrow: 'Jedan put: vozila iz Evrope',
  heroLine1: 'Pronađeno.',
  heroLine2: 'Provereno.',
  heroLine3: 'Odobreno.',
  stampText: 'PROVERENO · ODOBRENO · PROVERENO · ODOBRENO ·',
  heroSubtext: 'Pronalazimo, proveravamo, registrujemo i dovozimo vaše vozilo iz Nemačke, Španije ili Srbije — a zatim ga servisiramo u sopstvenom servisu. Jedan put, jedan tim.',
  statClients: { value: '200+', label: 'klijenata' },
  statCountries: { value: '4', label: 'zemlje' },
  statYears: { value: '5 god.', label: 'na tržištu' },
  journeyHeading: 'Jedan put: od pretrage do servisa',
  journeySubtext: 'Odabir, provera, otkup i auto servis nisu 4 različite usluge, već faze jednog puta vašeg vozila. Možete se uključiti u bilo kom koraku.',
  journeyMoreLabel: 'Saznajte više',
  countryStripLabel: 'Odabir vozila po zemljama:',
  latestCasesHeading: 'Poslednji primeri',
  whyUsHeading: 'Zašto nas biraju',
  whyUsSubtext: 'Kupovina vozila iz druge zemlje otvara mnoga pitanja. Evo kako ih rešavamo.',
  trustCards: [
    { title: 'Potpuna transparentnost', text: 'Šaljemo detaljnu listu provere (100+ stavki) i video svakog detalja: karoserija, enterijer, mehanika. Vozilo vidite kao da stojite pored njega.' },
    { title: 'Sigurnost posla', text: 'Plaćanje u fazama i jasni uslovi. Pratimo dokumentaciju u svakoj fazi — registracija, carinjenje, tablice — bez iznenađenja.' },
    { title: 'Lokalna stručnost', text: 'Poznajemo specifičnosti svakog tržišta: kilometražu na nemačkim autoputevima, karakteristike karoserije španskih vozila, nijanse registracije stranih tablica u Srbiji.' },
  ],
  testimonialsHeading: 'Šta kažu klijenti',
  testimonials: [
    { quote: '„Doveli su BMW serije 3 iz Minhena u Beograd. Sve je bilo precizno — od pregleda do registracije. Uštedeli su mi mnogo nerava oko papirologije.“', name: 'Александр', caption: 'BMW 320d, Nemačka → Srbija' },
    { quote: '„Dugo sam tražio Škoda Octaviju u dobrom stanju. Momci su pronašli ponudu u Španiji, proverio je nezavisni stručnjak — sve se poklopilo sa opisom.“', name: 'Михаил', caption: 'Škoda Octavia, Španija → Rusija' },
    { quote: '„Registracija stranih tablica delovala je komplikovano. Tim me proveo kroz svaki korak — i za mesec dana sam već vozio. Preporučujem.“', name: 'Дмитрий', caption: 'VW Passat, Nemačka → Srbija' },
  ],
  ctaEyebrow: 'Spremni da počnemo?',
  ctaHeading: { line1: 'Ispričajte nam', line2: 'o svom', accentWord: 'vozilu' },
  ctaSubtext: 'Odgovaramo u roku od 2 sata. Konsultacija je besplatna.',
  ctaTelegramLabel: 'Pišite nam na Telegramu',
  ctaStatClients: { value: '200+', label: 'klijenata' },
  ctaStatCountries: { value: '4', label: 'zemlje' },
  ctaStatYears: { value: '5 god.', label: 'iskustva' },
  ctaStatResponse: { value: '2 h', label: 'odgovor' },
};

const content: Record<Locale, HomeContent> = { ru, en, sr };

export function getHomeContent(locale: Locale): HomeContent {
  return content[locale];
}
