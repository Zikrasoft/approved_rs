import type { Locale } from '../config';

interface StepItem {
  n: string;
  text: string;
}

interface ServicesContent {
  autopodbor: {
    title: string;
    descriptionFor: (location: string) => string;
    ctaLabel: string;
    casesHeadingFor: (location: string) => string;
    breadcrumbLabelFor: (location: string) => string;
    stepsFor: (location: string) => StepItem[];
    deliveryLineFor: (destinations: string) => string;
    deliveryDestinations: string[];
    citiesLabel: string;
    alsoInLabel: string;
  };
  vykup: {
    title: string;
    ctaLabel: string;
    casesHeading: string;
    breadcrumbLabel: string;
    descriptionSerbia: string;
    descriptionOtherFor: (name: string) => string;
    step1: string;
    step2: string;
    step3Serbia: string;
    step3Other: string;
    step4: string;
  };
  proverka: {
    title: string;
    description: string;
    ctaLabel: string;
    breadcrumbLabel: string;
    steps: StepItem[];
    extraLine: string;
  };
  cityAutopodbor: {
    title: string;
    descriptionFor: (cityLocation: string, countryName: string) => string;
    casesHeadingFor: (countryGenitiveOrName: string) => string;
    whyCityHeadingFor: (cityName: string) => string;
    reason1: string;
    reason2: string;
    reason3For: (cityLocation: string) => string;
    reason4Dekra: string;
    reason4Generic: string;
    otherCitiesLabelFor: (countryLocation: string) => string;
  };
  avtoservisBelgrade: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    titleHighlight: string;
    description: string;
    ctaLabel: string;
    breadcrumbLabel: string;
    whatWeDoHeading: string;
    whatWeDo: { key: 'diagnostics' | 'maintenance' | 'suspension' | 'engine' | 'prepurchase'; label: string; desc: string }[];
    alsoSourcingLabel: string;
    howToFindHeading: string;
    addressLabel: string;
    streetAddress: string;
    cityCountryLine: string;
    mapButtonLabel: string;
    mapIframeTitle: string;
    worksHeading: string;
  };
  caseChrome: {
    autoLabel: string;
    yearLabel: string;
    priceLabel: string;
    realCaseFallback: string;
    ctaEyebrow: string;
    ctaHeading: string;
    ctaButtonLabel: string;
    geoWorkLabel: string;
    serviceBadges: Record<'autopodbor' | 'buyout' | 'inspection' | 'autoservice', string>;
  };
}

const ru: ServicesContent = {
  autopodbor: {
    title: 'Автоподбор под ключ',
    descriptionFor: (location) => `Подберём автомобиль ${location} с полной проверкой, оформим сделку и привезём до вашего города под ключ — включая растаможку.`,
    ctaLabel: 'Оставить заявку',
    casesHeadingFor: (location) => `Кейсы: автоподбор ${location}`,
    breadcrumbLabelFor: (location) => `Автоподбор ${location}`,
    stepsFor: (location) => [
      { n: '01', text: 'Оставляете заявку с требованиями — бюджет, марка, пробег' },
      { n: '02', text: `Ищем варианты ${location} по вашим критериям` },
      { n: '03', text: 'Независимый эксперт осматривает и проверяет автомобиль' },
      { n: '04', text: 'Сопровождаем сделку, помогаем с документами и оформлением' },
      { n: '05', text: 'Доставляем автомобиль до вашего города — под ключ, включая растаможку' },
    ],
    deliveryLineFor: (destinations) => `Доставляем в ${destinations} — и в любую другую страну, обсудим при заявке.`,
    deliveryDestinations: ['Россию', 'Казахстан', 'Кыргызстан', 'Украину', 'Беларусь', 'Боснию и Герцеговину', 'Хорватию', 'Северную Македонию', 'Турцию'],
    citiesLabel: 'Города:',
    alsoInLabel: 'Также подбираем в:',
  },
  vykup: {
    title: 'Выкуп авто',
    ctaLabel: 'Получить оценку',
    casesHeading: 'Кейсы выкупа',
    breadcrumbLabel: 'Выкуп авто',
    descriptionSerbia: 'Выкупаем автомобили на русских номерах ниже рыночной цены — машина может находиться в любой стране Европы. Также выкупаем авто на сербских номерах в Сербии и Черногории. Оценка онлайн, оформление за 1 день, перевод в день сделки.',
    descriptionOtherFor: (name) => `Выкупаем автомобили на русских номерах ниже рыночной цены — машина может находиться в любой стране Европы, включая ${name}. Оценка онлайн, оформление за 1 день, перевод в день сделки.`,
    step1: 'Отправляете фото и описание автомобиля',
    step2: 'Оцениваем онлайн по фото за 1 час — ниже рыночной цены',
    step3Serbia: 'Встречаемся на осмотр — русские номера (в любой стране Европы) или сербские номера (Сербия, Черногория)',
    step3Other: 'Встречаемся на осмотр — русские номера, машина может быть в любой стране Европы',
    step4: 'Оформляем сделку, деньги в день подписания',
  },
  proverka: {
    title: 'Проверка авто',
    description: 'Независимая проверка автомобиля перед покупкой. Выезд эксперта, диагностика, отчёт — без обязательства покупки.',
    ctaLabel: 'Заказать проверку',
    breadcrumbLabel: 'Проверка авто',
    steps: [
      { n: '01', text: 'Кузов и лакокрасочное покрытие — наличие ремонта или ДТП' },
      { n: '02', text: 'Ходовая, подвеска, тормоза' },
      { n: '03', text: 'Двигатель, коробка, трансмиссия' },
      { n: '04', text: 'Электроника и история обслуживания по VIN' },
      { n: '05', text: 'Юридическая чистота — залог, запрет регистрации, ДТП' },
    ],
    extraLine: 'Работаем и в других странах Европы, включая Португалию, — уточните при заявке.',
  },
  cityAutopodbor: {
    title: 'Автоподбор',
    descriptionFor: (cityLocation, countryName) => `Подберём автомобиль ${cityLocation} с полной проверкой. Работаем по всему региону ${countryName}.`,
    casesHeadingFor: (countryGenitiveOrName) => `Кейсы из ${countryGenitiveOrName}`,
    whyCityHeadingFor: (cityName) => `Почему ${cityName}`,
    reason1: 'Крупный автомобильный рынок региона',
    reason2: 'Много вариантов с хорошей историей',
    reason3For: (cityLocation) => `Наш эксперт ${cityLocation}`,
    reason4Dekra: 'Проверка DEKRA / TÜV по запросу',
    reason4Generic: 'Независимая техническая экспертиза по запросу',
    otherCitiesLabelFor: (countryLocation) => `Другие города ${countryLocation}:`,
  },
  avtoservisBelgrade: {
    metaTitle: 'Автосервис в Белграде — ремонт и обслуживание',
    metaDescription: 'Профессиональный ремонт и обслуживание автомобилей в Белграде с гарантией качества. Диагностика, ТО, ремонт подвески, двигателя и трансмиссии.',
    title: 'Автосервис',
    titleHighlight: 'в Белграде',
    description: 'Профессиональный ремонт и обслуживание автомобилей в Белграде с гарантией качества.',
    ctaLabel: 'Записаться на сервис',
    breadcrumbLabel: 'Автосервис в Белграде',
    whatWeDoHeading: 'Что мы делаем',
    whatWeDo: [
      { key: 'diagnostics', label: 'Компьютерная диагностика', desc: 'Поиск неисправностей современным диагностическим оборудованием' },
      { key: 'maintenance', label: 'Техническое обслуживание', desc: 'Замена масел, фильтров и технических жидкостей' },
      { key: 'suspension', label: 'Подвеска и тормоза', desc: 'Диагностика и ремонт подвески, тормозной системы и рулевого управления' },
      { key: 'engine', label: 'Двигатель и трансмиссия', desc: 'Ремонт двигателя, трансмиссии и навесного оборудования' },
      { key: 'prepurchase', label: 'Проверка перед покупкой', desc: 'Комплексная проверка автомобиля перед покупкой или дальней поездкой' },
    ],
    alsoSourcingLabel: 'Также подбираем авто:',
    howToFindHeading: 'Как нас найти',
    addressLabel: 'Адрес автосервиса',
    streetAddress: 'Пека Павловича 39',
    cityCountryLine: 'Белград, Сербия',
    mapButtonLabel: 'Открыть в Google Maps',
    mapIframeTitle: 'Автосервис на карте — Пека Павловича 39, Белград',
    worksHeading: 'Примеры работ',
  },
  caseChrome: {
    autoLabel: 'Авто',
    yearLabel: 'Год',
    priceLabel: 'Цена',
    realCaseFallback: 'Реальный кейс.',
    ctaEyebrow: 'Нужна такая же услуга?',
    ctaHeading: 'Обсудим ваш автомобиль',
    ctaButtonLabel: 'Написать в Telegram',
    geoWorkLabel: 'География работы',
    serviceBadges: { autopodbor: 'Автоподбор', buyout: 'Выкуп', inspection: 'Проверка', autoservice: 'Автосервис' },
  },
};

const en: ServicesContent = {
  autopodbor: {
    title: 'Full-Service Car Sourcing',
    descriptionFor: (location) => `We'll find your car ${location} with a full inspection, handle the paperwork, and deliver it to your city — fully turnkey, customs clearance included.`,
    ctaLabel: 'Submit a Request',
    casesHeadingFor: (location) => `Case Studies: Car Sourcing ${location}`,
    breadcrumbLabelFor: (location) => `Car Sourcing ${location}`,
    stepsFor: (location) => [
      { n: '01', text: 'Submit your requirements — budget, make, mileage' },
      { n: '02', text: `We search for matches ${location} based on your criteria` },
      { n: '03', text: 'An independent expert inspects the car in person' },
      { n: '04', text: 'We support the deal and help with paperwork and registration' },
      { n: '05', text: 'We deliver the car to your city — fully turnkey, customs clearance included' },
    ],
    deliveryLineFor: (destinations) => `We deliver to ${destinations} — and any other country, just ask when you submit a request.`,
    deliveryDestinations: ['Russia', 'Kazakhstan', 'Kyrgyzstan', 'Ukraine', 'Belarus', 'Bosnia and Herzegovina', 'Croatia', 'North Macedonia', 'Turkey'],
    citiesLabel: 'Cities:',
    alsoInLabel: 'Also sourcing in:',
  },
  vykup: {
    title: 'Car Buyout',
    ctaLabel: 'Get a Valuation',
    casesHeading: 'Buyout Case Studies',
    breadcrumbLabel: 'Car Buyout',
    descriptionSerbia: 'We buy cars on Russian plates below market price — the car can be anywhere in Europe. We also buy cars on Serbian plates in Serbia and Montenegro. Online valuation, paperwork done in a day, payment the same day as the deal.',
    descriptionOtherFor: (name) => `We buy cars on Russian plates below market price — the car can be anywhere in Europe, including ${name}. Online valuation, paperwork done in a day, payment the same day as the deal.`,
    step1: 'Send photos and a description of the car',
    step2: 'We give an online valuation from photos within an hour — below market price',
    step3Serbia: 'We meet for inspection — Russian plates (anywhere in Europe) or Serbian plates (Serbia, Montenegro)',
    step3Other: 'We meet for inspection — Russian plates, the car can be anywhere in Europe',
    step4: 'We complete the deal — you get paid the day you sign',
  },
  proverka: {
    title: 'Car Inspection',
    description: 'Independent car inspection before you buy. An expert visits in person, runs diagnostics, and sends a report — no obligation to purchase.',
    ctaLabel: 'Order an Inspection',
    breadcrumbLabel: 'Car Inspection',
    steps: [
      { n: '01', text: 'Body and paintwork — checking for prior repairs or accident damage' },
      { n: '02', text: 'Running gear, suspension, brakes' },
      { n: '03', text: 'Engine, gearbox, transmission' },
      { n: '04', text: 'Electronics and service history by VIN' },
      { n: '05', text: 'Legal status — liens, registration holds, accident history' },
    ],
    extraLine: 'We also work in other European countries, including Portugal — ask when you submit a request.',
  },
  cityAutopodbor: {
    title: 'Car Sourcing',
    descriptionFor: (cityLocation, countryName) => `We'll find your car ${cityLocation} with a full inspection. We cover all of ${countryName}.`,
    casesHeadingFor: (countryGenitiveOrName) => `Case Studies from ${countryGenitiveOrName}`,
    whyCityHeadingFor: (cityName) => `Why ${cityName}`,
    reason1: 'A major car market for the region',
    reason2: 'Plenty of well-documented options',
    reason3For: (cityLocation) => `Our expert is based ${cityLocation}`,
    reason4Dekra: 'DEKRA / TÜV inspection available on request',
    reason4Generic: 'Independent technical inspection available on request',
    otherCitiesLabelFor: (countryLocation) => `Other cities ${countryLocation}:`,
  },
  avtoservisBelgrade: {
    metaTitle: 'Auto Service in Belgrade — Repair and Maintenance',
    metaDescription: 'Professional car repair and maintenance in Belgrade with a quality guarantee. Diagnostics, scheduled maintenance, suspension, engine, and transmission repair.',
    title: 'Auto Service',
    titleHighlight: 'in Belgrade',
    description: 'Professional car repair and maintenance in Belgrade with a quality guarantee.',
    ctaLabel: 'Book a Service',
    breadcrumbLabel: 'Auto Service in Belgrade',
    whatWeDoHeading: 'What We Do',
    whatWeDo: [
      { key: 'diagnostics', label: 'Computer Diagnostics', desc: 'Finding faults with modern diagnostic equipment' },
      { key: 'maintenance', label: 'Scheduled Maintenance', desc: 'Oil, filter, and fluid changes' },
      { key: 'suspension', label: 'Suspension & Brakes', desc: 'Diagnostics and repair of the suspension, brakes, and steering' },
      { key: 'engine', label: 'Engine & Transmission', desc: 'Engine, transmission, and ancillary equipment repair' },
      { key: 'prepurchase', label: 'Pre-Purchase Inspection', desc: 'A full inspection before you buy a car or take it on a long trip' },
    ],
    alsoSourcingLabel: 'Also sourcing cars in:',
    howToFindHeading: 'How to Find Us',
    addressLabel: 'Service Address',
    streetAddress: 'Peka Pavlovića 39',
    cityCountryLine: 'Belgrade, Serbia',
    mapButtonLabel: 'Open in Google Maps',
    mapIframeTitle: 'Auto service on the map — Peka Pavlovića 39, Belgrade',
    worksHeading: 'Our Work',
  },
  caseChrome: {
    autoLabel: 'Car',
    yearLabel: 'Year',
    priceLabel: 'Price',
    realCaseFallback: 'A real case.',
    ctaEyebrow: 'Need the same service?',
    ctaHeading: "Let's talk about your car",
    ctaButtonLabel: 'Message on Telegram',
    geoWorkLabel: 'Where We Work',
    serviceBadges: { autopodbor: 'Sourcing', buyout: 'Buyout', inspection: 'Inspection', autoservice: 'Service' },
  },
};

const sr: ServicesContent = {
  autopodbor: {
    title: 'Kompletan odabir vozila',
    descriptionFor: (location) => `Pronaći ćemo vozilo ${location} uz potpunu proveru, sklopiti posao i dovesti ga do vašeg grada — sve na ključ, uključujući carinjenje.`,
    ctaLabel: 'Pošaljite zahtev',
    casesHeadingFor: (location) => `Primeri: odabir vozila ${location}`,
    breadcrumbLabelFor: (location) => `Odabir vozila ${location}`,
    stepsFor: (location) => [
      { n: '01', text: 'Ostavljate zahtev sa kriterijumima — budžet, marka, kilometraža' },
      { n: '02', text: `Tražimo ponude ${location} prema vašim kriterijumima` },
      { n: '03', text: 'Nezavisni stručnjak pregleda i proverava vozilo' },
      { n: '04', text: 'Pratimo tok posla i pomažemo oko dokumentacije i registracije' },
      { n: '05', text: 'Dovozimo vozilo do vašeg grada — sve na ključ, uključujući carinjenje' },
    ],
    deliveryLineFor: (destinations) => `Dostavljamo u ${destinations} — i u bilo koju drugu zemlju, dogovorite prilikom slanja zahteva.`,
    deliveryDestinations: ['Rusiju', 'Kazahstan', 'Kirgistan', 'Ukrajinu', 'Belorusiju', 'Bosnu i Hercegovinu', 'Hrvatsku', 'Severnu Makedoniju', 'Tursku'],
    citiesLabel: 'Gradovi:',
    alsoInLabel: 'Takođe pronalazimo vozila i u:',
  },
  vykup: {
    title: 'Otkup vozila',
    ctaLabel: 'Zatražite procenu',
    casesHeading: 'Primeri otkupa',
    breadcrumbLabel: 'Otkup vozila',
    descriptionSerbia: 'Otkupljujemo vozila na ruskim tablicama ispod tržišne cene — vozilo može biti bilo gde u Evropi. Takođe otkupljujemo vozila na srpskim tablicama u Srbiji i Crnoj Gori. Procena onlajn, papirologija za 1 dan, isplata na dan dogovora.',
    descriptionOtherFor: (name) => `Otkupljujemo vozila na ruskim tablicama ispod tržišne cene — vozilo može biti bilo gde u Evropi, uključujući ${name}. Procena onlajn, papirologija za 1 dan, isplata na dan dogovora.`,
    step1: 'Šaljete fotografije i opis vozila',
    step2: 'Procenjujemo onlajn na osnovu fotografija za 1 sat — ispod tržišne cene',
    step3Serbia: 'Dogovaramo pregled — ruske tablice (bilo gde u Evropi) ili srpske tablice (Srbija, Crna Gora)',
    step3Other: 'Dogovaramo pregled — ruske tablice, vozilo može biti bilo gde u Evropi',
    step4: 'Sklapamo posao — novac dobijate na dan potpisivanja',
  },
  proverka: {
    title: 'Provera vozila',
    description: 'Nezavisna provera vozila pre kupovine. Stručnjak izlazi na teren, radi dijagnostiku i šalje izveštaj — bez obaveze kupovine.',
    ctaLabel: 'Naručite proveru',
    breadcrumbLabel: 'Provera vozila',
    steps: [
      { n: '01', text: 'Karoserija i lak — provera prethodnih popravki ili udesa' },
      { n: '02', text: 'Mehanika, vešanje, kočnice' },
      { n: '03', text: 'Motor, menjač, transmisija' },
      { n: '04', text: 'Elektronika i istorija održavanja po VIN broju' },
      { n: '05', text: 'Pravna čistoća — zaloga, zabrana registracije, udesi' },
    ],
    extraLine: 'Radimo i u drugim evropskim zemljama, uključujući Portugaliju — proverite prilikom slanja zahteva.',
  },
  cityAutopodbor: {
    title: 'Odabir vozila',
    descriptionFor: (cityLocation, countryName) => `Pronaći ćemo vozilo ${cityLocation} uz potpunu proveru. Radimo širom ${countryName}.`,
    casesHeadingFor: (countryGenitiveOrName) => `Primeri iz ${countryGenitiveOrName}`,
    whyCityHeadingFor: (cityName) => `Zašto ${cityName}`,
    reason1: 'Veliko tržište vozila u regionu',
    reason2: 'Mnogo ponuda sa urednom istorijom',
    reason3For: (cityLocation) => `Naš stručnjak je ${cityLocation}`,
    reason4Dekra: 'DEKRA / TÜV provera na zahtev',
    reason4Generic: 'Nezavisna tehnička provera na zahtev',
    otherCitiesLabelFor: (countryLocation) => `Drugi gradovi ${countryLocation}:`,
  },
  avtoservisBelgrade: {
    metaTitle: 'Auto servis u Beogradu — popravka i održavanje',
    metaDescription: 'Profesionalna popravka i održavanje vozila u Beogradu uz garanciju kvaliteta. Dijagnostika, redovno servisiranje, popravka vešanja, motora i transmisije.',
    title: 'Auto servis',
    titleHighlight: 'u Beogradu',
    description: 'Profesionalna popravka i održavanje vozila u Beogradu uz garanciju kvaliteta.',
    ctaLabel: 'Zakažite servis',
    breadcrumbLabel: 'Auto servis u Beogradu',
    whatWeDoHeading: 'Šta radimo',
    whatWeDo: [
      { key: 'diagnostics', label: 'Kompjuterska dijagnostika', desc: 'Pronalaženje kvarova savremenom dijagnostičkom opremom' },
      { key: 'maintenance', label: 'Redovno servisiranje', desc: 'Zamena ulja, filtera i tehničkih tečnosti' },
      { key: 'suspension', label: 'Vešanje i kočnice', desc: 'Dijagnostika i popravka vešanja, kočionog sistema i upravljača' },
      { key: 'engine', label: 'Motor i transmisija', desc: 'Popravka motora, transmisije i prateće opreme' },
      { key: 'prepurchase', label: 'Provera pre kupovine', desc: 'Kompletna provera vozila pre kupovine ili duže vožnje' },
    ],
    alsoSourcingLabel: 'Takođe pronalazimo vozila i u:',
    howToFindHeading: 'Kako nas pronaći',
    addressLabel: 'Adresa servisa',
    streetAddress: 'Peka Pavlovića 39',
    cityCountryLine: 'Beograd, Srbija',
    mapButtonLabel: 'Otvorite u Google mapama',
    mapIframeTitle: 'Auto servis na mapi — Peka Pavlovića 39, Beograd',
    worksHeading: 'Primeri radova',
  },
  caseChrome: {
    autoLabel: 'Vozilo',
    yearLabel: 'Godište',
    priceLabel: 'Cena',
    realCaseFallback: 'Stvaran primer.',
    ctaEyebrow: 'Treba vam ista usluga?',
    ctaHeading: 'Razgovarajmo o vašem vozilu',
    ctaButtonLabel: 'Pišite nam na Telegramu',
    geoWorkLabel: 'Gde radimo',
    serviceBadges: { autopodbor: 'Odabir', buyout: 'Otkup', inspection: 'Provera', autoservice: 'Servis' },
  },
};

const content: Record<Locale, ServicesContent> = { ru, en, sr };

export function getServicesContent(locale: Locale): ServicesContent {
  return content[locale];
}
