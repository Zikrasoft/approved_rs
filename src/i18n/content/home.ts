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

// Country count is derived live from countries.json (getActiveCountries().length)
// at the call site — a hardcoded value here would go stale the moment a
// country is added or removed, as it silently did when Portugal was added.
interface CountStatItem {
  label: string;
}

interface HomeContent {
  metaTitle: string;
  metaDescription: string;
  journey: [JourneyStep, JourneyStep, JourneyStep, JourneyStep, JourneyStep];
  heroEyebrow: string;
  heroLine1: string;
  heroLine2: string;
  heroLine3: string;
  stampText: string;
  heroSubtext: string;
  statClients: StatItem;
  statCountries: CountStatItem;
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
  ctaStatCountries: CountStatItem;
  ctaStatYears: StatItem;
  ctaStatResponse: StatItem;
}

const ru: HomeContent = {
  metaTitle: 'Автоподбор и привоз авто под ключ',
  metaDescription: 'Автоподбор в своей стране или привоз авто из Европы и Китая — под ключ. Проверка, выкуп, автосервис. Работаем для русскоязычных по всему миру.',
  journey: [
    { title: 'Подбор', desc: 'Находим, проверяем и доставляем автомобиль под ваш бюджет — под ключ, в Германии, Испании, Сербии и Швейцарии.' },
    { title: 'Привоз', desc: 'Машина не в вашей стране? Подберём и привезём её из Германии, Европы или Китая — под ключ, включая растаможку.' },
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
  statCountries: { label: 'страны' },
  statYears: { value: '5 лет', label: 'на рынке' },
  journeyHeading: 'Один путь: от поиска до сервиса',
  journeySubtext: 'Автоподбор, привоз, проверка, выкуп и автосервис — не разные услуги, а этапы одного пути вашего автомобиля. Войти можно с любого шага.',
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
  ctaStatCountries: { label: 'страны' },
  ctaStatYears: { value: '5 лет', label: 'опыт' },
  ctaStatResponse: { value: '2 ч', label: 'ответ' },
};

const en: HomeContent = {
  metaTitle: 'Car Sourcing and Import, Fully Turnkey',
  metaDescription: 'Car sourcing in your own country, or import from Europe and China — fully turnkey. Inspection, buyback, auto service. Serving Russian-speaking clients worldwide.',
  journey: [
    { title: 'Sourcing', desc: 'We find, inspect, and deliver a car that fits your budget — fully turnkey, in Germany, Spain, Serbia, and Switzerland.' },
    { title: 'Import', desc: "Car isn't in your country? We'll source it and bring it from Germany, Europe, or China — fully turnkey, customs clearance included." },
    { title: 'Inspection', desc: 'An independent expert inspects the car before purchase — 100+ checkpoints, with video.', note: 'Already found a car yourself? We can inspect it separately' },
    { title: 'Buyback', desc: 'We handle the buyback and customs clearance for cars on foreign plates.', note: "Already have the car abroad? We'll help register it" },
    { title: 'Auto Service', desc: 'Car repair and maintenance in Belgrade — with a quality guarantee.', note: 'Already own the car? We handle that too' },
  ],
  heroEyebrow: 'One path: cars from Europe',
  heroLine1: 'Found.',
  heroLine2: 'Inspected.',
  heroLine3: 'Approved.',
  stampText: 'INSPECTED · APPROVED · INSPECTED · APPROVED ·',
  heroSubtext: 'We source, inspect, register, and deliver your car from Germany, Spain, or Serbia — then service it at our own shop. One path, one team.',
  statClients: { value: '200+', label: 'clients' },
  statCountries: { label: 'countries' },
  statYears: { value: '5 yrs', label: 'on the market' },
  journeyHeading: 'One Path: From Search to Service',
  journeySubtext: "Sourcing, import, inspection, buyback, and auto service aren't separate services — they're stages of one journey for your car. Jump in at any step.",
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
  ctaStatCountries: { label: 'countries' },
  ctaStatYears: { value: '5 yrs', label: 'experience' },
  ctaStatResponse: { value: '2 hrs', label: 'response' },
};

const sr: HomeContent = {
  metaTitle: 'Odabir i uvoz vozila na ključ',
  metaDescription: 'Odabir vozila u vašoj zemlji ili uvoz iz Evrope i Kine — sve na ključ. Provera, otkup, auto servis. Radimo za rusko govorno tržište širom sveta.',
  journey: [
    { title: 'Odabir', desc: 'Pronalazimo, proveravamo i dovozimo vozilo prema vašem budžetu — sve na ključ, u Nemačkoj, Španiji, Srbiji i Švajcarskoj.' },
    { title: 'Uvoz', desc: 'Vozilo nije u vašoj zemlji? Pronaći ćemo ga i dovesti iz Nemačke, Evrope ili Kine — sve na ključ, uključujući carinjenje.' },
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
  statCountries: { label: 'zemlje' },
  statYears: { value: '5 god.', label: 'na tržištu' },
  journeyHeading: 'Jedan put: od pretrage do servisa',
  journeySubtext: 'Odabir, uvoz, provera, otkup i auto servis nisu različite usluge, već faze jednog puta vašeg vozila. Možete se uključiti u bilo kom koraku.',
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
  ctaStatCountries: { label: 'zemlje' },
  ctaStatYears: { value: '5 god.', label: 'iskustva' },
  ctaStatResponse: { value: '2 h', label: 'odgovor' },
};

const es: HomeContent = {
  metaTitle: 'Búsqueda e importación de coches, llave en mano',
  metaDescription: 'Búsqueda de coches en tu propio país o importación desde Europa y China, todo llave en mano. Inspección, recompra, taller mecánico. Atendemos a clientes de habla rusa en todo el mundo.',
  journey: [
    { title: 'Búsqueda', desc: 'Buscamos, inspeccionamos y entregamos el coche que se ajusta a tu presupuesto, todo llave en mano, en Alemania, España, Serbia y Suiza.' },
    { title: 'Importación', desc: '¿El coche no está en tu país? Lo buscamos y lo traemos desde Alemania, Europa o China, todo llave en mano, incluido el despacho de aduanas.' },
    { title: 'Inspección', desc: 'Un perito independiente inspecciona el coche antes de la compra: más de 100 puntos de control, con vídeo.', note: '¿Ya encontraste el coche por tu cuenta? Podemos hacer la inspección por separado' },
    { title: 'Recompra', desc: 'Gestionamos la recompra y el despacho de aduanas de coches con matrícula extranjera.', note: '¿El coche ya está en el extranjero? Te ayudamos a tramitarlo' },
    { title: 'Taller mecánico', desc: 'Reparación y mantenimiento del coche en Belgrado, con garantía de calidad.', note: '¿El coche ya es tuyo? También nos encargamos' },
  ],
  heroEyebrow: 'Un solo camino: coches desde Europa',
  heroLine1: 'Encontrado.',
  heroLine2: 'Inspeccionado.',
  heroLine3: 'Aprobado.',
  stampText: 'INSPECCIONADO · APROBADO · INSPECCIONADO · APROBADO ·',
  heroSubtext: 'Buscamos, inspeccionamos, tramitamos y traemos tu coche desde Alemania, España o Serbia, y luego lo mantenemos en nuestro propio taller. Un solo camino, un solo equipo.',
  statClients: { value: '200+', label: 'clientes' },
  statCountries: { label: 'países' },
  statYears: { value: '5 años', label: 'en el mercado' },
  journeyHeading: 'Un solo camino: de la búsqueda al taller',
  journeySubtext: 'Búsqueda, importación, inspección, recompra y taller mecánico no son servicios independientes, sino etapas de un mismo camino para tu coche. Puedes entrar en cualquier etapa.',
  journeyMoreLabel: 'Más información',
  countryStripLabel: 'Búsqueda de coches por país:',
  latestCasesHeading: 'Últimos casos',
  whyUsHeading: 'Por qué nos eligen',
  whyUsSubtext: 'Comprar un coche en otro país genera dudas. Así es como las resolvemos.',
  trustCards: [
    { title: 'Transparencia total', text: 'Te enviamos una lista de verificación detallada (más de 100 puntos) y un vídeo de cada detalle: carrocería, interior, mecánica. Ves el coche como si estuvieras allí mismo.' },
    { title: 'Seguridad en la operación', text: 'Pago por etapas y condiciones claras. Te acompañamos con la documentación en cada fase: trámites, aduana, matriculación, sin sorpresas.' },
    { title: 'Experiencia local', text: 'Conocemos las particularidades de cada mercado: el kilometraje de autopista alemán, las características de la carrocería de los coches españoles, los detalles de matricular vehículos con placas extranjeras en Serbia.' },
  ],
  testimonialsHeading: 'Lo que dicen nuestros clientes',
  testimonials: [
    { quote: '«Trajeron un BMW Serie 3 desde Múnich a Belgrado. Todo salió perfecto, desde la inspección hasta la matriculación. Me ahorraron muchos dolores de cabeza con el papeleo.»', name: 'Александр', caption: 'BMW 320d, Alemania → Serbia' },
    { quote: '«Llevaba tiempo buscando un Škoda Octavia en buen estado. El equipo encontró uno en España y lo revisó un perito independiente: todo coincidía con la descripción.»', name: 'Михаил', caption: 'Škoda Octavia, España → Rusia' },
    { quote: '«Matricular el coche con placas extranjeras parecía complicado. El equipo me guió en cada paso y, un mes después, ya estaba conduciendo. Lo recomiendo.»', name: 'Дмитрий', caption: 'VW Passat, Alemania → Serbia' },
  ],
  ctaEyebrow: '¿Listo para empezar?',
  ctaHeading: { line1: 'Cuéntanos', line2: 'sobre tu', accentWord: 'coche' },
  ctaSubtext: 'Respondemos en menos de 2 horas. La consulta es gratuita.',
  ctaTelegramLabel: 'Escríbenos por Telegram',
  ctaStatClients: { value: '200+', label: 'clientes' },
  ctaStatCountries: { label: 'países' },
  ctaStatYears: { value: '5 años', label: 'de experiencia' },
  ctaStatResponse: { value: '2 h', label: 'respuesta' },
};

const de: HomeContent = {
  metaTitle: 'Fahrzeugbeschaffung und -import, schlüsselfertig',
  metaDescription: 'Fahrzeugbeschaffung in Ihrem eigenen Land oder Import aus Europa und China – alles schlüsselfertig. Inspektion, Ankauf, Autowerkstatt. Wir betreuen russischsprachige Kunden weltweit.',
  journey: [
    { title: 'Beschaffung', desc: 'Wir finden, prüfen und liefern das Fahrzeug passend zu Ihrem Budget – schlüsselfertig, in Deutschland, Spanien, Serbien und der Schweiz.' },
    { title: 'Import', desc: 'Das Fahrzeug befindet sich nicht in Ihrem Land? Wir beschaffen und bringen es aus Deutschland, Europa oder China – schlüsselfertig, inklusive Verzollung.' },
    { title: 'Inspektion', desc: 'Ein unabhängiger Gutachter prüft das Fahrzeug vor dem Kauf – anhand von über 100 Prüfpunkten, mit Video.', note: 'Sie haben das Fahrzeug bereits selbst gefunden? Wir übernehmen die Prüfung auch separat' },
    { title: 'Ankauf', desc: 'Wir übernehmen den Ankauf und die Verzollung von Fahrzeugen mit ausländischen Kennzeichen.', note: 'Das Fahrzeug befindet sich bereits im Ausland? Wir helfen bei der Anmeldung' },
    { title: 'Autowerkstatt', desc: 'Reparatur und Wartung Ihres Fahrzeugs in Belgrad – mit Qualitätsgarantie.', note: 'Das Fahrzeug gehört Ihnen bereits? Auch dafür sind wir da' },
  ],
  heroEyebrow: 'Ein Weg: Fahrzeuge aus Europa',
  heroLine1: 'Gefunden.',
  heroLine2: 'Geprüft.',
  heroLine3: 'Freigegeben.',
  stampText: 'GEPRÜFT · FREIGEGEBEN · GEPRÜFT · FREIGEGEBEN ·',
  heroSubtext: 'Wir beschaffen, prüfen, melden an und liefern Ihr Fahrzeug aus Deutschland, Spanien oder Serbien – und warten es anschließend in unserer eigenen Werkstatt. Ein Weg, ein Team.',
  statClients: { value: '200+', label: 'Kunden' },
  statCountries: { label: 'Länder' },
  statYears: { value: '5 Jahre', label: 'am Markt' },
  journeyHeading: 'Ein Weg: von der Suche bis zum Service',
  journeySubtext: 'Beschaffung, Import, Inspektion, Ankauf und Autowerkstatt sind keine getrennten Leistungen, sondern Etappen eines einzigen Weges für Ihr Fahrzeug. Sie können an jedem Schritt einsteigen.',
  journeyMoreLabel: 'Mehr erfahren',
  countryStripLabel: 'Fahrzeugbeschaffung nach Ländern:',
  latestCasesHeading: 'Aktuelle Projekte',
  whyUsHeading: 'Warum Sie uns wählen',
  whyUsSubtext: 'Der Kauf eines Fahrzeugs aus einem anderen Land wirft Fragen auf. So gehen wir damit um.',
  trustCards: [
    { title: 'Volle Transparenz', text: 'Wir senden Ihnen eine detaillierte Checkliste (über 100 Punkte) und ein Video zu jedem Detail: Karosserie, Innenraum, Fahrwerk. Sie sehen das Fahrzeug, als stünden Sie direkt daneben.' },
    { title: 'Sichere Abwicklung', text: 'Zahlung in Etappen und klare Bedingungen. Wir begleiten die Unterlagen in jeder Phase – Anmeldung, Verzollung, Zulassung – ohne Überraschungen.' },
    { title: 'Lokale Expertise', text: 'Wir kennen die Besonderheiten jedes Marktes: Autobahnkilometer in Deutschland, die Karosseriemerkmale spanischer Fahrzeuge, die Feinheiten der Zulassung ausländischer Kennzeichen in Serbien.' },
  ],
  testimonialsHeading: 'Was unsere Kunden sagen',
  testimonials: [
    { quote: '„Sie haben einen BMW 3er von München nach Belgrad gebracht. Alles lief reibungslos – von der Prüfung bis zur Zulassung. Das hat mir bei der Abwicklung viel Nerven erspart.“', name: 'Александр', caption: 'BMW 320d, Deutschland → Serbien' },
    { quote: '„Ich habe lange nach einem Škoda Octavia in gutem Zustand gesucht. Das Team hat ein Fahrzeug in Spanien gefunden und von einem unabhängigen Gutachter prüfen lassen – alles stimmte mit der Beschreibung überein.“', name: 'Михаил', caption: 'Škoda Octavia, Spanien → Russland' },
    { quote: '„Die Anmeldung mit ausländischen Kennzeichen schien kompliziert. Das Team hat mich durch jeden Schritt begleitet – einen Monat später bin ich schon gefahren. Sehr zu empfehlen.“', name: 'Дмитрий', caption: 'VW Passat, Deutschland → Serbien' },
  ],
  ctaEyebrow: 'Bereit anzufangen?',
  ctaHeading: { line1: 'Erzählen Sie uns', line2: 'von Ihrem', accentWord: 'Fahrzeug' },
  ctaSubtext: 'Wir antworten innerhalb von 2 Stunden. Die Beratung ist kostenlos.',
  ctaTelegramLabel: 'Auf Telegram schreiben',
  ctaStatClients: { value: '200+', label: 'Kunden' },
  ctaStatCountries: { label: 'Länder' },
  ctaStatYears: { value: '5 Jahre', label: 'Erfahrung' },
  ctaStatResponse: { value: '2 Std.', label: 'Antwortzeit' },
};

const content: Record<Locale, HomeContent> = { ru, en, sr, es, de };

export function getHomeContent(locale: Locale): HomeContent {
  return content[locale];
}
