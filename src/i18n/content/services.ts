import type { Locale } from '@/i18n/config';

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
    // Cross-sell into privoz — only rendered on the handful of country pages
    // that match a real corridor (see [country]/index.astro), not a nav-wide
    // label, so it's generic enough to sit above any of the privoz spokes.
    crossSellLabel: string;
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
  privoz: {
    hub: {
      metaTitle: string;
      metaDescription: string;
      title: string;
      titleHighlight: string;
      description: string;
      breadcrumbLabel: string;
      deCardTitle: string;
      deCardText: string;
      euCardTitle: string;
      euCardText: string;
      chinaCardTitle: string;
      chinaCardText: string;
      exploreLabel: string;
    };
    de: {
      metaTitle: string;
      metaDescription: string;
      title: string;
      titleHighlight: string;
      description: string;
      ctaLabel: string;
      breadcrumbLabel: string;
      casesHeading: string;
      steps: StepItem[];
      // Names the actual corridor (Serbia/Spain/Portugal) instead of the
      // generic CIS-country list autopodbor's deliveryLineFor reuses
      // elsewhere — that list doesn't include any of this page's real
      // destinations, so it would misrepresent the corridor.
      destinationsNote: string;
      chinaCrossLabel: string;
    };
    eu: {
      metaTitle: string;
      metaDescription: string;
      title: string;
      titleHighlight: string;
      description: string;
      ctaLabel: string;
      breadcrumbLabel: string;
      casesHeading: string;
      steps: StepItem[];
      sourceCountriesLabel: string;
      sourceMoreLabel: string;
      destinationsNote: string;
    };
    china: {
      metaTitle: string;
      metaDescription: string;
      title: string;
      titleHighlight: string;
      description: string;
      ctaLabel: string;
      breadcrumbLabel: string;
      casesHeading: string;
      steps: StepItem[];
      deCrossLabel: string;
      destinationsNote: string;
    };
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
    whatsappButtonLabel: string;
    viberButtonLabel: string;
    callbackButtonLabel: string;
    // Short form for compact chips (icon-row cells) sitting next to single-
    // word brand names (Telegram/WhatsApp/Viber) — the full phrase is a
    // two-word outlier there and wraps awkwardly in a narrow grid cell.
    callbackShortLabel: string;
    callButtonLabel: string;
    usefulInfoLabel: string;
    channelBannerTitle: string;
    channelBannerText: string;
    channelBannerCta: string;
    serviceBadges: Record<'autopodbor' | 'buyout' | 'inspection' | 'autoservice', string>;
  };
}

// Step 01 (submit the request) and the final customs/handover step read
// identically across all 3 privoz spokes (de/eu/china) — only the sourcing
// step(s) in between differ per spoke. Shared per-locale instead of the
// same literal string repeated 3x.
const PRIVOZ_STEP_REQUEST_RU = { n: '01', text: 'Оставляете заявку с требованиями — бюджет, марка, пробег' };
const PRIVOZ_STEP_HANDOVER_RU = { n: '05', text: 'Растаможка и передача автомобиля вам — под ключ' };

const ru: ServicesContent = {
  autopodbor: {
    title: 'Автоподбор под ключ',
    descriptionFor: (location) => `Подберём автомобиль ${location} — среди авто, которые уже в этой стране, без ввоза из-за рубежа. Полная проверка, сопровождение сделки и доставка до вашего города — под ключ, включая растаможку.`,
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
    crossSellLabel: 'Нужен не местный автомобиль?',
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
  privoz: {
    hub: {
      metaTitle: 'Привоз авто из Европы и Китая под ключ',
      metaDescription: 'Привозим автомобили из Германии, Испании, Швейцарии и Китая в любую страну — подбор, проверка, доставка и растаможка под ключ.',
      title: 'Привоз авто',
      titleHighlight: 'из Европы и Китая',
      description: 'Машина — в Европе или Китае, вы — где угодно. Подбираем, проверяем и привозим её к вам под ключ, включая растаможку.',
      breadcrumbLabel: 'Привоз авто',
      deCardTitle: 'Из Германии',
      deCardText: 'Прямой источник — подбор и привоз из Германии в любую точку.',
      euCardTitle: 'Из Европы',
      euCardText: 'Испания, Швейцария и другие страны — подбор и доставка в любую точку.',
      chinaCardTitle: 'Из Китая',
      chinaCardText: 'Новые и подержанные автомобили из Китая — доставка через проверенного партнёра.',
      exploreLabel: 'Подробнее',
    },
    de: {
      metaTitle: 'Авто из Германии под ключ — подбор и привоз',
      metaDescription: 'Подберём и привезём автомобиль из Германии — проверка, оформление и растаможка под ключ. Доставляли в Сербию, Испанию и Португалию.',
      title: 'Авто из Германии',
      titleHighlight: 'под ключ',
      description: 'Подбираем машину из Германии и привозим к вам, где бы вы ни находились: проверка, оформление и растаможка под ключ.',
      ctaLabel: 'Оставить заявку',
      breadcrumbLabel: 'Авто из Германии',
      casesHeading: 'Кейсы: авто из Германии',
      steps: [
        PRIVOZ_STEP_REQUEST_RU,
        { n: '02', text: 'Подбираем авто из Германии по вашим критериям' },
        { n: '03', text: 'Независимый эксперт осматривает и проверяет автомобиль на месте' },
        { n: '04', text: 'Оформляем экспортные документы и организуем доставку до вашего города' },
        PRIVOZ_STEP_HANDOVER_RU,
      ],
      destinationsNote: 'Доставляем в Сербию, Испанию и Португалию — и в любую другую страну, обсудим при заявке.',
      chinaCrossLabel: 'Рассматриваете привоз из Китая?',
    },
    eu: {
      metaTitle: 'Авто из Европы под ключ — подбор и привоз',
      metaDescription: 'Подберём и привезём автомобиль из любой страны ЕС — Германия, Испания, Швейцария и другие — проверка, оформление и растаможка под ключ.',
      title: 'Авто из Европы',
      titleHighlight: 'под ключ',
      description: 'Подбираем машину из Европы — Германия, Испания, Швейцария и другие страны ЕС — и привозим к вам, где бы вы ни находились: проверка, оформление и растаможка под ключ.',
      ctaLabel: 'Оставить заявку',
      breadcrumbLabel: 'Авто из Европы',
      casesHeading: 'Кейсы: авто из Европы',
      steps: [
        PRIVOZ_STEP_REQUEST_RU,
        { n: '02', text: 'Подбираем авто из Европы — Германия, Испания, Швейцария и другие страны ЕС' },
        { n: '03', text: 'Независимый эксперт осматривает и проверяет автомобиль на месте' },
        { n: '04', text: 'Оформляем экспортные документы и организуем доставку до вашего города' },
        PRIVOZ_STEP_HANDOVER_RU,
      ],
      sourceCountriesLabel: 'Привозим из:',
      sourceMoreLabel: 'и другие страны ЕС',
      destinationsNote: 'Доставляем в Сербию, Испанию и Португалию — и в любую другую страну, обсудим при заявке.',
    },
    china: {
      metaTitle: 'Авто из Китая под ключ — подбор и привоз',
      metaDescription: 'Организуем привоз автомобиля из Китая в любую страну через проверенного партнёра по логистике — подбор, оформление и растаможка под ключ.',
      title: 'Авто из Китая',
      titleHighlight: 'под ключ',
      description: 'Подбираем машину из Китая и привозим к вам, где бы вы ни находились, — напрямую через проверенного партнёра по логистике, под ключ, включая растаможку.',
      ctaLabel: 'Оставить заявку',
      breadcrumbLabel: 'Авто из Китая',
      casesHeading: 'Кейсы: авто из Китая',
      steps: [
        PRIVOZ_STEP_REQUEST_RU,
        { n: '02', text: 'Подбираем авто из Китая по вашим критериям' },
        { n: '03', text: 'Проверяем автомобиль и оформляем экспортные документы' },
        { n: '04', text: 'Организуем доставку до вашего города через партнёра по логистике' },
        PRIVOZ_STEP_HANDOVER_RU,
      ],
      deCrossLabel: 'Ищете авто из Германии?',
      destinationsNote: 'Доставляем в Сербию и Германию — и в любую другую страну, обсудим при заявке.',
    },
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
    whatsappButtonLabel: 'Написать в WhatsApp',
    viberButtonLabel: 'Написать в Viber',
    callbackButtonLabel: 'Заказать звонок',
    callbackShortLabel: 'Звонок',
    callButtonLabel: 'Позвонить',
    channelBannerTitle: 'Ещё больше кейсов',
    channelBannerText: 'Публикуем новые кейсы, процесс подбора и полезные советы.',
    channelBannerCta: 'Подписаться',
    usefulInfoLabel: 'Полезная информация',
    serviceBadges: { autopodbor: 'Автоподбор', buyout: 'Выкуп', inspection: 'Проверка', autoservice: 'Автосервис' },
  },
};

const PRIVOZ_STEP_REQUEST_EN = { n: '01', text: 'Submit your requirements — budget, make, mileage' };
const PRIVOZ_STEP_HANDOVER_EN = { n: '05', text: 'Customs clearance and handover — fully turnkey' };

const en: ServicesContent = {
  autopodbor: {
    title: 'Full-Service Car Sourcing',
    descriptionFor: (location) => `We'll find your car ${location} — sourced from cars already in the country, not shipped in from abroad. Full inspection, deal support, and delivery to your city — fully turnkey, customs clearance included.`,
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
    crossSellLabel: 'Need a car that isn\'t local?',
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
  privoz: {
    hub: {
      metaTitle: 'Turnkey Car Import from Europe and China',
      metaDescription: 'We import cars from Germany, Spain, Switzerland, and China to any country — sourcing, inspection, delivery, and customs clearance, fully turnkey.',
      title: 'Car Import',
      titleHighlight: 'from Europe and China',
      description: "The car is in Europe or China — you can be anywhere. We source it, inspect it, and bring it to you, fully turnkey, customs clearance included.",
      breadcrumbLabel: 'Car Import',
      deCardTitle: 'From Germany',
      deCardText: 'Direct source — sourced and delivered from Germany, wherever you are.',
      euCardTitle: 'From Europe',
      euCardText: 'Spain, Switzerland, and more — sourced and delivered wherever you are.',
      chinaCardTitle: 'From China',
      chinaCardText: 'New and used cars from China, delivered through a trusted logistics partner.',
      exploreLabel: 'Learn more',
    },
    de: {
      metaTitle: 'Cars from Germany — Turnkey Import',
      metaDescription: 'We source and deliver cars from Germany — inspection, paperwork, and customs clearance, fully turnkey. Delivered to Serbia, Spain, and Portugal.',
      title: 'Cars from Germany',
      titleHighlight: 'Turnkey',
      description: "We source the car from Germany and deliver it to you, wherever you are: inspection, paperwork, and customs clearance, fully turnkey.",
      ctaLabel: 'Submit a Request',
      breadcrumbLabel: 'Cars from Germany',
      casesHeading: 'Case Studies: Cars from Germany',
      steps: [
        PRIVOZ_STEP_REQUEST_EN,
        { n: '02', text: 'We search for a match from Germany to your criteria' },
        { n: '03', text: 'An independent expert inspects the car on site' },
        { n: '04', text: 'We handle export paperwork and arrange delivery to your city' },
        PRIVOZ_STEP_HANDOVER_EN,
      ],
      destinationsNote: "We deliver to Serbia, Spain, and Portugal — and anywhere else, just ask when you submit a request.",
      chinaCrossLabel: 'Considering a car from China?',
    },
    eu: {
      metaTitle: 'Cars from Europe — Turnkey Import',
      metaDescription: 'We source and deliver cars from any EU country — Germany, Spain, Switzerland, and more — inspection, paperwork, and customs clearance, fully turnkey.',
      title: 'Cars from Europe',
      titleHighlight: 'Turnkey',
      description: "We source the car from Europe — Germany, Spain, Switzerland, and other EU countries — and deliver it to you, wherever you are: inspection, paperwork, and customs clearance, fully turnkey.",
      ctaLabel: 'Submit a Request',
      breadcrumbLabel: 'Cars from Europe',
      casesHeading: 'Case Studies: Cars from Europe',
      steps: [
        PRIVOZ_STEP_REQUEST_EN,
        { n: '02', text: 'We search for a match from Europe — Germany, Spain, Switzerland, and other EU countries' },
        { n: '03', text: 'An independent expert inspects the car on site' },
        { n: '04', text: 'We handle export paperwork and arrange delivery to your city' },
        PRIVOZ_STEP_HANDOVER_EN,
      ],
      sourceCountriesLabel: 'We source from:',
      sourceMoreLabel: 'and other EU countries',
      destinationsNote: 'We deliver to Serbia, Spain, and Portugal — and anywhere else, just ask when you submit a request.',
    },
    china: {
      metaTitle: 'Cars from China — Turnkey Import',
      metaDescription: 'We arrange car import from China to any country through a trusted logistics partner — sourcing, paperwork, and customs clearance, fully turnkey.',
      title: 'Cars from China',
      titleHighlight: 'Turnkey',
      description: "We source the car from China and deliver it to you, wherever you are, directly through a trusted logistics partner, fully turnkey, customs clearance included.",
      ctaLabel: 'Submit a Request',
      breadcrumbLabel: 'Cars from China',
      casesHeading: 'Case Studies: Cars from China',
      steps: [
        PRIVOZ_STEP_REQUEST_EN,
        { n: '02', text: 'We search for a match from China to your criteria' },
        { n: '03', text: 'We inspect the car and handle export paperwork' },
        { n: '04', text: 'We arrange delivery to your city through our logistics partner' },
        PRIVOZ_STEP_HANDOVER_EN,
      ],
      deCrossLabel: 'Looking for a car from Germany?',
      destinationsNote: 'We deliver to Serbia and Germany — and anywhere else, just ask when you submit a request.',
    },
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
    whatsappButtonLabel: 'Message on WhatsApp',
    viberButtonLabel: 'Message on Viber',
    callbackButtonLabel: 'Request a Callback',
    callbackShortLabel: 'Callback',
    callButtonLabel: 'Call Us',
    channelBannerTitle: 'More Real Cases',
    channelBannerText: 'We post new case studies, the sourcing process, and useful tips.',
    channelBannerCta: 'Subscribe',
    usefulInfoLabel: 'Useful Information',
    serviceBadges: { autopodbor: 'Sourcing', buyout: 'Buyout', inspection: 'Inspection', autoservice: 'Service' },
  },
};

const PRIVOZ_STEP_REQUEST_SR = { n: '01', text: 'Ostavljate zahtev sa kriterijumima — budžet, marka, kilometraža' };
const PRIVOZ_STEP_HANDOVER_SR = { n: '05', text: 'Carinjenje i predaja vozila — sve na ključ' };

const sr: ServicesContent = {
  autopodbor: {
    title: 'Kompletan odabir vozila',
    descriptionFor: (location) => `Pronaći ćemo vozilo ${location} — biramo među vozilima koja su već u zemlji, ne dovozimo ih iz inostranstva. Potpuna provera, podrška tokom kupovine i dovoz do vašeg grada — sve na ključ, uključujući carinjenje.`,
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
    crossSellLabel: 'Treba vam vozilo koje nije lokalno?',
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
  privoz: {
    hub: {
      metaTitle: 'Uvoz vozila iz Evrope i Kine na ključ',
      metaDescription: 'Uvozimo vozila iz Nemačke, Španije, Švajcarske i Kine u bilo koju zemlju — odabir, provera, dovoz i carinjenje na ključ.',
      title: 'Uvoz vozila',
      titleHighlight: 'iz Evrope i Kine',
      description: 'Vozilo je u Evropi ili Kini, vi ste bilo gde. Biramo ga, proveravamo i dovozimo do vas na ključ, uključujući carinjenje.',
      breadcrumbLabel: 'Uvoz vozila',
      deCardTitle: 'Iz Nemačke',
      deCardText: 'Direktan izvor — odabir i dovoz iz Nemačke bilo gde da ste.',
      euCardTitle: 'Iz Evrope',
      euCardText: 'Španija, Švajcarska i druge zemlje — odabir i dovoz bilo gde.',
      chinaCardTitle: 'Iz Kine',
      chinaCardText: 'Nova i polovna vozila iz Kine — dovoz preko proverenog partnera.',
      exploreLabel: 'Saznajte više',
    },
    de: {
      metaTitle: 'Vozila iz Nemačke — uvoz na ključ',
      metaDescription: 'Biramo i dovozimo vozila iz Nemačke — provera, papirologija i carinjenje na ključ. Dovozili smo u Srbiju, Španiju i Portugaliju.',
      title: 'Vozila iz Nemačke',
      titleHighlight: 'na ključ',
      description: 'Vozilo biramo iz Nemačke i dovozimo do vas, gde god da ste: provera, papirologija i carinjenje na ključ.',
      ctaLabel: 'Pošaljite zahtev',
      breadcrumbLabel: 'Vozila iz Nemačke',
      casesHeading: 'Primeri: vozila iz Nemačke',
      steps: [
        PRIVOZ_STEP_REQUEST_SR,
        { n: '02', text: 'Tražimo vozilo iz Nemačke prema vašim kriterijumima' },
        { n: '03', text: 'Nezavisni stručnjak pregleda vozilo na licu mesta' },
        { n: '04', text: 'Sređujemo izvoznu dokumentaciju i organizujemo dovoz do vašeg grada' },
        PRIVOZ_STEP_HANDOVER_SR,
      ],
      destinationsNote: 'Već smo dovozili u Srbiju, Španiju i Portugaliju — dovozimo i u bilo koju drugu zemlju, dogovorite prilikom slanja zahteva.',
      chinaCrossLabel: 'Razmatrate uvoz iz Kine?',
    },
    eu: {
      metaTitle: 'Vozila iz Evrope — uvoz na ključ',
      metaDescription: 'Biramo i dovozimo vozila iz bilo koje zemlje EU — Nemačka, Španija, Švajcarska i druge — provera, papirologija i carinjenje na ključ.',
      title: 'Vozila iz Evrope',
      titleHighlight: 'na ključ',
      description: 'Vozilo biramo iz Evrope — Nemačka, Španija, Švajcarska i druge zemlje EU — i dovozimo do vas, gde god da ste: provera, papirologija i carinjenje na ključ.',
      ctaLabel: 'Pošaljite zahtev',
      breadcrumbLabel: 'Vozila iz Evrope',
      casesHeading: 'Primeri: vozila iz Evrope',
      steps: [
        PRIVOZ_STEP_REQUEST_SR,
        { n: '02', text: 'Tražimo vozilo iz Evrope — Nemačka, Španija, Švajcarska i druge zemlje EU' },
        { n: '03', text: 'Nezavisni stručnjak pregleda vozilo na licu mesta' },
        { n: '04', text: 'Sređujemo izvoznu dokumentaciju i organizujemo dovoz do vašeg grada' },
        PRIVOZ_STEP_HANDOVER_SR,
      ],
      sourceCountriesLabel: 'Dovozimo iz:',
      sourceMoreLabel: 'i druge zemlje EU',
      destinationsNote: 'Dovozimo u Srbiju, Španiju i Portugaliju — i u bilo koju drugu zemlju, dogovorite prilikom slanja zahteva.',
    },
    china: {
      metaTitle: 'Vozila iz Kine — uvoz na ključ',
      metaDescription: 'Organizujemo uvoz vozila iz Kine u bilo koju zemlju preko proverenog logističkog partnera — odabir, papirologija i carinjenje na ključ.',
      title: 'Vozila iz Kine',
      titleHighlight: 'na ključ',
      description: 'Vozilo biramo iz Kine i dovozimo do vas, gde god da ste, direktno preko proverenog logističkog partnera, na ključ, uključujući carinjenje.',
      ctaLabel: 'Pošaljite zahtev',
      breadcrumbLabel: 'Vozila iz Kine',
      casesHeading: 'Primeri: vozila iz Kine',
      steps: [
        PRIVOZ_STEP_REQUEST_SR,
        { n: '02', text: 'Tražimo vozilo iz Kine prema vašim kriterijumima' },
        { n: '03', text: 'Proveravamo vozilo i sređujemo izvoznu dokumentaciju' },
        { n: '04', text: 'Organizujemo dovoz do vašeg grada preko logističkog partnera' },
        PRIVOZ_STEP_HANDOVER_SR,
      ],
      deCrossLabel: 'Tražite vozilo iz Nemačke?',
      destinationsNote: 'Dovozimo u Srbiju i Nemačku — i u bilo koju drugu zemlju, dogovorite prilikom slanja zahteva.',
    },
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
    whatsappButtonLabel: 'Pišite nam na WhatsAppu',
    viberButtonLabel: 'Pišite nam na Viberu',
    callbackButtonLabel: 'Zakažite poziv',
    callbackShortLabel: 'Poziv',
    callButtonLabel: 'Pozovite nas',
    channelBannerTitle: 'Još primera iz prakse',
    channelBannerText: 'Objavljujemo nove primere, proces odabira i korisne savete.',
    channelBannerCta: 'Pratite nas',
    usefulInfoLabel: 'Korisne informacije',
    serviceBadges: { autopodbor: 'Odabir', buyout: 'Otkup', inspection: 'Provera', autoservice: 'Servis' },
  },
};

const content: Record<Locale, ServicesContent> = { ru, en, sr };

export function getServicesContent(locale: Locale): ServicesContent {
  return content[locale];
}
