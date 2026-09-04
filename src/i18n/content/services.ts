import type { Locale } from '@/i18n/config';
import type {
  ServiceSlug,
  AUTOSERVICE_SERVICES,
  DETAILING_SERVICES,
} from '@/utils/labels';

interface StepItem {
  n: string;
  text: string;
}

// Shared shape for each single-country EU source spoke (de/es/ch) — same
// fields, only the wording differs per country. One definition instead of
// retyping it 3 times.
interface EuCountrySpokeContent {
  metaTitle: string;
  metaDescription: string;
  title: string;
  titleHighlight: string;
  description: string;
  ctaLabel: string;
  breadcrumbLabel: string;
  casesHeading: string;
  steps: StepItem[];
  destinationsNote: string;
  chinaCrossLabel: string;
}

export interface ServicesContent {
  'vehicle-sourcing': {
    // Bare /vehicle-sourcing/ (no country) — a country-picker landing page,
    // same role as vehicle-import's hub, so an unprefixed or otherwise
    // country-less visit has somewhere real to land instead of a 404.
    hub: {
      metaTitle: string;
      metaDescription: string;
      title: string;
      titleHighlight: string;
      description: string;
      breadcrumbLabel: string;
      casesHeading: string;
      chooseCountryLabel: string;
      // Hub CTA opens the same lead modal as every other service page — needs
      // its own action-oriented label since it has no single country/service
      // context to fall back on (unlike the country pages' own ctaLabel below).
      ctaLabel: string;
    };
    title: string;
    descriptionFor: (location: string) => string;
    ctaLabel: string;
    casesHeadingFor: (location: string) => string;
    // Breadcrumb leaf under the hub crumb (Автоподбор / {this}) — "Авто
    // {location}" not "Автоподбор {location}", since the parent crumb
    // already says Автоподбор; repeating it in the leaf too read oddly.
    breadcrumbLabelFor: (location: string) => string;
    stepsFor: (location: string) => StepItem[];
    deliveryLineFor: (destinations: string) => string;
    deliveryDestinations: string[];
    citiesLabel: string;
    alsoInLabel: string;
    // Cross-sell into vehicle-import — only rendered on the handful of country pages
    // that match a real corridor (see [country]/index.astro), not a nav-wide
    // label, so it's generic enough to sit above any of the vehicle-import spokes.
    crossSellLabel: string;
  };
  'vehicle-buyback': {
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
  'vehicle-import': {
    hub: {
      metaTitle: string;
      metaDescription: string;
      title: string;
      titleHighlight: string;
      description: string;
      breadcrumbLabel: string;
      casesHeading: string;
      euCardTitle: string;
      euCardText: string;
      chinaCardTitle: string;
      chinaCardText: string;
      exploreLabel: string;
      // Same rationale as vehicle-sourcing's hub.ctaLabel above.
      ctaLabel: string;
    };
    // Names the actual corridor (Serbia/Spain/Portugal) instead of the
    // generic CIS-country list vehicle sourcing's deliveryLineFor reuses
    // elsewhere — that list doesn't include any of this page's real
    // destinations, so it would misrepresent the corridor.
    de: EuCountrySpokeContent;
    es: EuCountrySpokeContent;
    ch: EuCountrySpokeContent;
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
  'vehicle-inspection': {
    title: string;
    description: string;
    ctaLabel: string;
    casesHeading: string;
    breadcrumbLabel: string;
    steps: StepItem[];
    extraLine: string;
  };
  cityVehicleSourcing: {
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
  autoServiceBelgrade: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    titleHighlight: string;
    description: string;
    ctaLabel: string;
    breadcrumbLabel: string;
    whatWeDoHeading: string;
    whatWeDo: {
      key: (typeof AUTOSERVICE_SERVICES)[number];
      label: string;
      desc: string;
    }[];
    // The visitor already owns the car and wants a repair, not a purchase
    // within a budget — overrides LeadForm's default "Марка, модель, бюджет"
    // (see leadForm.ts), which is written for vehicle-sourcing.
    commentLabel: string;
    commentPlaceholder: string;
    alsoSourcingLabel: string;
    howToFindHeading: string;
    addressLabel: string;
    streetAddress: string;
    cityCountryLine: string;
    mapButtonLabel: string;
    mapIframeTitle: string;
    worksHeading: string;
  };
  detailingBelgrade: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    titleHighlight: string;
    description: string;
    ctaLabel: string;
    breadcrumbLabel: string;
    whatWeDoHeading: string;
    // Keyed by DETAILING_SERVICES (src/utils/labels.ts) — one entry per
    // live detailing service. Only 'wrap' exists today; add siblings here
    // (and to DETAILING_SERVICES + keystatic.config.ts) as the client adds
    // more (ceramic, anti-gravel film, etc.).
    whatWeDo: {
      key: (typeof DETAILING_SERVICES)[number];
      label: string;
      desc: string;
    }[];
    // Same override as autoServiceBelgrade.commentLabel — visitor already
    // owns the car, describing the work needed, not a purchase budget.
    commentLabel: string;
    commentPlaceholder: string;
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
    serviceBadges: Record<ServiceSlug, string>;
  };
}

// Step 01 (submit the request) and the final customs/handover step read
// identically across all 3 vehicle-import spokes (de/eu/china) — only the sourcing
// step(s) in between differ per spoke. Shared per-locale instead of the
// same literal string repeated 3x.
const PRIVOZ_STEP_REQUEST_RU = {
  n: '01',
  text: 'Оставляете заявку с требованиями — бюджет, марка, пробег',
};
const PRIVOZ_STEP_INSPECT_RU = {
  n: '03',
  text: 'Независимый эксперт осматривает и проверяет автомобиль на месте',
};
const PRIVOZ_STEP_EXPORT_RU = {
  n: '04',
  text: 'Оформляем экспортные документы и организуем доставку до вашего города',
};
const PRIVOZ_STEP_HANDOVER_RU = {
  n: '05',
  text: 'Растаможка и передача автомобиля вам — под ключ',
};
// Step 02 for each single-country EU spoke (de/es/ch) reads identically
// apart from the country name — one template instead of 3 near-duplicate strings.
const vehicleImportStep02RU = (countryGenitive: string) => ({
  n: '02',
  text: `Подбираем авто из ${countryGenitive} по вашим критериям`,
});

const ru: ServicesContent = {
  'vehicle-sourcing': {
    hub: {
      metaTitle: 'Автоподбор под ключ — выберите страну',
      metaDescription:
        'Подбираем автомобиль в Германии, Сербии, Испании, Швейцарии и Португалии — полная проверка, сопровождение сделки и доставка под ключ. Выберите страну поиска.',
      title: 'Автоподбор',
      titleHighlight: 'под ключ',
      description:
        'Подбираем автомобиль в стране, где вы находитесь или планируете покупку, — полная проверка, сопровождение сделки и доставка под ключ. Выберите страну, чтобы увидеть детали.',
      breadcrumbLabel: 'Автоподбор',
      casesHeading: 'Кейсы автоподбора',
      chooseCountryLabel: 'Выберите страну:',
      ctaLabel: 'Подобрать авто',
    },
    title: 'Автоподбор под ключ',
    descriptionFor: (location) =>
      `Подберём автомобиль ${location} — среди авто, которые уже в этой стране, без ввоза из-за рубежа. Полная проверка, сопровождение сделки и доставка до вашего города — под ключ, включая растаможку.`,
    ctaLabel: 'Оставить заявку',
    casesHeadingFor: (location) => `Кейсы: автоподбор ${location}`,
    breadcrumbLabelFor: (location) => `Авто ${location}`,
    stepsFor: (location) => [
      {
        n: '01',
        text: 'Оставляете заявку с требованиями — бюджет, марка, пробег',
      },
      { n: '02', text: `Ищем варианты ${location} по вашим критериям` },
      {
        n: '03',
        text: 'Независимый эксперт осматривает и проверяет автомобиль',
      },
      {
        n: '04',
        text: 'Сопровождаем сделку, помогаем с документами и оформлением',
      },
      {
        n: '05',
        text: 'Доставляем автомобиль до вашего города — под ключ, включая растаможку',
      },
    ],
    deliveryLineFor: (destinations) =>
      `Доставляем в ${destinations} — и в любую другую страну, обсудим при заявке.`,
    deliveryDestinations: [
      'Россию',
      'Казахстан',
      'Кыргызстан',
      'Украину',
      'Беларусь',
      'Боснию и Герцеговину',
      'Хорватию',
      'Северную Македонию',
      'Турцию',
    ],
    citiesLabel: 'Города:',
    alsoInLabel: 'Также подбираем в:',
    crossSellLabel: 'Нужен не местный автомобиль?',
  },
  'vehicle-buyback': {
    title: 'Выкуп авто',
    ctaLabel: 'Получить оценку',
    casesHeading: 'Кейсы выкупа',
    breadcrumbLabel: 'Выкуп авто',
    descriptionSerbia:
      'Выкупаем автомобили на русских номерах ниже рыночной цены — машина может находиться в любой стране Европы. Также выкупаем авто на сербских номерах в Сербии и Черногории. Оценка онлайн, оформление за 1 день, перевод в день сделки.',
    descriptionOtherFor: (name) =>
      `Выкупаем автомобили на русских номерах ниже рыночной цены — машина может находиться в любой стране Европы, включая ${name}. Оценка онлайн, оформление за 1 день, перевод в день сделки.`,
    step1: 'Отправляете фото и описание автомобиля',
    step2: 'Оцениваем онлайн по фото за 1 час — ниже рыночной цены',
    step3Serbia:
      'Встречаемся на осмотр — русские номера (в любой стране Европы) или сербские номера (Сербия, Черногория)',
    step3Other:
      'Встречаемся на осмотр — русские номера, машина может быть в любой стране Европы',
    step4: 'Оформляем сделку, деньги в день подписания',
  },
  'vehicle-import': {
    hub: {
      metaTitle: 'Привоз авто из Европы и Китая под ключ',
      metaDescription:
        'Привозим автомобили из Германии, Испании, Швейцарии и Китая в любую страну — подбор, проверка, доставка и растаможка под ключ.',
      title: 'Привоз авто',
      titleHighlight: 'из Европы и Китая',
      description:
        'Машина — в Европе или Китае, вы — где угодно. Подбираем, проверяем и привозим её к вам под ключ, включая растаможку.',
      breadcrumbLabel: 'Привоз авто',
      casesHeading: 'Кейсы привоза',
      euCardTitle: 'Из Европы',
      euCardText:
        'Испания, Швейцария и другие страны — подбор и доставка в любую точку.',
      chinaCardTitle: 'Из Китая',
      chinaCardText:
        'Новые и подержанные автомобили из Китая — доставка через проверенного партнёра.',
      exploreLabel: 'Подробнее',
      ctaLabel: 'Рассчитать привоз',
    },
    de: {
      metaTitle: 'Авто из Германии под ключ — подбор и привоз',
      metaDescription:
        'Подберём и привезём автомобиль из Германии — проверка, оформление и растаможка под ключ. Доставляли в Сербию, Испанию и Португалию.',
      title: 'Авто из Германии',
      titleHighlight: 'под ключ',
      description:
        'Подбираем машину из Германии и привозим к вам, где бы вы ни находились: проверка, оформление и растаможка под ключ.',
      ctaLabel: 'Оставить заявку',
      breadcrumbLabel: 'Авто из Германии',
      casesHeading: 'Кейсы: авто из Германии',
      steps: [
        PRIVOZ_STEP_REQUEST_RU,
        vehicleImportStep02RU('Германии'),
        PRIVOZ_STEP_INSPECT_RU,
        PRIVOZ_STEP_EXPORT_RU,
        PRIVOZ_STEP_HANDOVER_RU,
      ],
      destinationsNote:
        'Доставляем в Сербию, Испанию и Португалию — и в любую другую страну, обсудим при заявке.',
      chinaCrossLabel: 'Рассматриваете привоз из Китая?',
    },
    es: {
      metaTitle: 'Авто из Испании под ключ — подбор и привоз',
      metaDescription:
        'Подберём и привезём автомобиль из Испании — проверка, оформление и растаможка под ключ. Доставляли в Сербию и Португалию.',
      title: 'Авто из Испании',
      titleHighlight: 'под ключ',
      description:
        'Подбираем машину из Испании и привозим к вам, где бы вы ни находились: проверка, оформление и растаможка под ключ.',
      ctaLabel: 'Оставить заявку',
      breadcrumbLabel: 'Авто из Испании',
      casesHeading: 'Кейсы: авто из Испании',
      steps: [
        PRIVOZ_STEP_REQUEST_RU,
        vehicleImportStep02RU('Испании'),
        PRIVOZ_STEP_INSPECT_RU,
        PRIVOZ_STEP_EXPORT_RU,
        PRIVOZ_STEP_HANDOVER_RU,
      ],
      destinationsNote:
        'Доставляем в Сербию и Португалию — и в любую другую страну, обсудим при заявке.',
      chinaCrossLabel: 'Рассматриваете привоз из Китая?',
    },
    ch: {
      metaTitle: 'Авто из Швейцарии под ключ — подбор и привоз',
      metaDescription:
        'Подберём и привезём автомобиль из Швейцарии — проверка, оформление и растаможка под ключ. Доставляли в Сербию, Испанию и Португалию.',
      title: 'Авто из Швейцарии',
      titleHighlight: 'под ключ',
      description:
        'Подбираем машину из Швейцарии и привозим к вам, где бы вы ни находились: проверка, оформление и растаможка под ключ.',
      ctaLabel: 'Оставить заявку',
      breadcrumbLabel: 'Авто из Швейцарии',
      casesHeading: 'Кейсы: авто из Швейцарии',
      steps: [
        PRIVOZ_STEP_REQUEST_RU,
        vehicleImportStep02RU('Швейцарии'),
        PRIVOZ_STEP_INSPECT_RU,
        PRIVOZ_STEP_EXPORT_RU,
        PRIVOZ_STEP_HANDOVER_RU,
      ],
      destinationsNote:
        'Доставляем в Сербию, Испанию и Португалию — и в любую другую страну, обсудим при заявке.',
      chinaCrossLabel: 'Рассматриваете привоз из Китая?',
    },
    eu: {
      metaTitle: 'Авто из Европы под ключ — подбор и привоз',
      metaDescription:
        'Подберём и привезём автомобиль из любой европейской страны — Германия, Испания, Швейцария и другие — проверка, оформление и растаможка под ключ.',
      title: 'Авто из Европы',
      titleHighlight: 'под ключ',
      description:
        'Подбираем машину из Европы — Германия, Испания, Швейцария и другие европейские страны — и привозим к вам, где бы вы ни находились: проверка, оформление и растаможка под ключ.',
      ctaLabel: 'Оставить заявку',
      breadcrumbLabel: 'Авто из Европы',
      casesHeading: 'Кейсы: авто из Европы',
      steps: [
        PRIVOZ_STEP_REQUEST_RU,
        {
          n: '02',
          text: 'Подбираем авто из Европы — Германия, Испания, Швейцария и другие европейские страны',
        },
        PRIVOZ_STEP_INSPECT_RU,
        PRIVOZ_STEP_EXPORT_RU,
        PRIVOZ_STEP_HANDOVER_RU,
      ],
      sourceCountriesLabel: 'Привозим из:',
      sourceMoreLabel: 'и другие страны Европы',
      destinationsNote:
        'Доставляем в Сербию, Испанию и Португалию — и в любую другую страну, обсудим при заявке.',
    },
    china: {
      metaTitle: 'Авто из Китая под ключ — подбор и привоз',
      metaDescription:
        'Организуем привоз автомобиля из Китая в любую страну через проверенного партнёра по логистике — подбор, оформление и растаможка под ключ.',
      title: 'Авто из Китая',
      titleHighlight: 'под ключ',
      description:
        'Подбираем машину из Китая и привозим к вам, где бы вы ни находились, — напрямую через проверенного партнёра по логистике, под ключ, включая растаможку.',
      ctaLabel: 'Оставить заявку',
      breadcrumbLabel: 'Авто из Китая',
      casesHeading: 'Кейсы: авто из Китая',
      steps: [
        PRIVOZ_STEP_REQUEST_RU,
        { n: '02', text: 'Подбираем авто из Китая по вашим критериям' },
        {
          n: '03',
          text: 'Проверяем автомобиль и оформляем экспортные документы',
        },
        {
          n: '04',
          text: 'Организуем доставку до вашего города через партнёра по логистике',
        },
        PRIVOZ_STEP_HANDOVER_RU,
      ],
      deCrossLabel: 'Ищете авто из Германии?',
      destinationsNote:
        'Доставляем в Сербию и Германию — и в любую другую страну, обсудим при заявке.',
    },
  },
  'vehicle-inspection': {
    title: 'Проверка авто',
    description:
      'Независимая проверка автомобиля перед покупкой. Выезд эксперта, диагностика, отчёт — без обязательства покупки.',
    ctaLabel: 'Заказать проверку',
    casesHeading: 'Кейсы проверки',
    breadcrumbLabel: 'Проверка авто',
    steps: [
      {
        n: '01',
        text: 'Кузов и лакокрасочное покрытие — наличие ремонта или ДТП',
      },
      { n: '02', text: 'Ходовая, подвеска, тормоза' },
      { n: '03', text: 'Двигатель, коробка, трансмиссия' },
      { n: '04', text: 'Электроника и история обслуживания по VIN' },
      { n: '05', text: 'Юридическая чистота — залог, запрет регистрации, ДТП' },
    ],
    extraLine:
      'Работаем и в других странах Европы, включая Португалию, — уточните при заявке.',
  },
  cityVehicleSourcing: {
    title: 'Автоподбор',
    descriptionFor: (cityLocation, countryName) =>
      `Подберём автомобиль ${cityLocation} с полной проверкой. Работаем по всему региону ${countryName}.`,
    casesHeadingFor: (countryGenitiveOrName) =>
      `Кейсы из ${countryGenitiveOrName}`,
    whyCityHeadingFor: (cityName) => `Почему ${cityName}`,
    reason1: 'Крупный автомобильный рынок региона',
    reason2: 'Много вариантов с хорошей историей',
    reason3For: (cityLocation) => `Наш эксперт ${cityLocation}`,
    reason4Dekra: 'Проверка DEKRA / TÜV по запросу',
    reason4Generic: 'Независимая техническая экспертиза по запросу',
    otherCitiesLabelFor: (countryLocation) =>
      `Другие города ${countryLocation}:`,
  },
  autoServiceBelgrade: {
    metaTitle: 'Автосервис в Белграде — ремонт и обслуживание',
    metaDescription:
      'Профессиональный ремонт и обслуживание автомобилей в Белграде с гарантией качества. Диагностика, ТО, ремонт подвески, двигателя и трансмиссии.',
    title: 'Автосервис',
    titleHighlight: 'в Белграде',
    description:
      'Профессиональный ремонт и обслуживание автомобилей в Белграде с гарантией качества.',
    ctaLabel: 'Записаться на сервис',
    breadcrumbLabel: 'Автосервис в Белграде',
    whatWeDoHeading: 'Что мы делаем',
    whatWeDo: [
      {
        key: 'diagnostics',
        label: 'Компьютерная диагностика',
        desc: 'Поиск неисправностей современным диагностическим оборудованием',
      },
      {
        key: 'maintenance',
        label: 'Техническое обслуживание',
        desc: 'Замена масел, фильтров и технических жидкостей',
      },
      {
        key: 'suspension',
        label: 'Подвеска и тормоза',
        desc: 'Диагностика и ремонт подвески, тормозной системы и рулевого управления',
      },
      {
        key: 'engine',
        label: 'Двигатель и трансмиссия',
        desc: 'Ремонт двигателя, трансмиссии и навесного оборудования',
      },
      {
        key: 'prepurchase',
        label: 'Проверка перед покупкой',
        desc: 'Комплексная проверка автомобиля перед покупкой или дальней поездкой',
      },
    ],
    commentLabel: 'Марка, модель, что нужно сделать',
    commentPlaceholder: 'BMW 320i, 2018, стук в подвеске…',
    alsoSourcingLabel: 'Также подбираем авто:',
    howToFindHeading: 'Как нас найти',
    addressLabel: 'Адрес автосервиса',
    streetAddress: 'Пека Павловича 39',
    cityCountryLine: 'Белград, Сербия',
    mapButtonLabel: 'Открыть в Google Maps',
    mapIframeTitle: 'Автосервис на карте — Пека Павловича 39, Белград',
    worksHeading: 'Примеры работ',
  },
  detailingBelgrade: {
    metaTitle: 'Детейлинг в Белграде — оклейка плёнкой авто, мото, вело, яхт',
    metaDescription:
      'Детейлинг в Белграде: оклейка плёнкой автомобилей, мотоциклов, велосипедов и яхт.',
    title: 'Детейлинг',
    titleHighlight: 'в Белграде',
    description:
      'Профессиональный детейлинг в Белграде: оклейка плёнкой автомобилей, мотоциклов, велосипедов и яхт.',
    ctaLabel: 'Оставить заявку',
    breadcrumbLabel: 'Детейлинг в Белграде',
    whatWeDoHeading: 'Наши услуги',
    whatWeDo: [
      {
        key: 'wrap',
        label: 'Оклейка плёнкой',
        desc: 'Полная и частичная оклейка кузова автомобилей, мотоциклов, велосипедов и яхт защитной или декоративной плёнкой',
      },
    ],
    commentLabel: 'Марка, модель, что нужно сделать',
    commentPlaceholder: 'BMW X5, 2019, оклейка плёнкой…',
    alsoSourcingLabel: 'Также подбираем авто:',
    howToFindHeading: 'Как нас найти',
    addressLabel: 'Адрес',
    streetAddress: 'Паштровичева 8',
    cityCountryLine: 'Белград, Сербия',
    mapButtonLabel: 'Открыть в Google Maps',
    mapIframeTitle: 'Детейлинг на карте — Паштровичева 8, Белград',
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
    channelBannerText:
      'Публикуем новые кейсы, процесс подбора и полезные советы.',
    channelBannerCta: 'Подписаться',
    usefulInfoLabel: 'Полезная информация',
    serviceBadges: {
      'vehicle-sourcing': 'Автоподбор',
      'vehicle-buyback': 'Выкуп',
      'vehicle-inspection': 'Проверка',
      'vehicle-import': 'Привоз',
      'auto-service-belgrade': 'Автосервис',
      'detailing-belgrade': 'Детейлинг',
    },
  },
};

const PRIVOZ_STEP_REQUEST_EN = {
  n: '01',
  text: 'Submit your requirements — budget, make, mileage',
};
const PRIVOZ_STEP_INSPECT_EN = {
  n: '03',
  text: 'An independent expert inspects the car on site',
};
const PRIVOZ_STEP_EXPORT_EN = {
  n: '04',
  text: 'We handle export paperwork and arrange delivery to your city',
};
const PRIVOZ_STEP_HANDOVER_EN = {
  n: '05',
  text: 'Customs clearance and handover — fully turnkey',
};
const vehicleImportStep02EN = (countryName: string) => ({
  n: '02',
  text: `We search for a match from ${countryName} to your criteria`,
});

const en: ServicesContent = {
  'vehicle-sourcing': {
    hub: {
      metaTitle: 'Full-Service Car Sourcing — Choose a Country',
      metaDescription:
        'We source cars in Germany, Serbia, Spain, Switzerland, and Portugal — full inspection, deal support, and delivery, fully turnkey. Choose a country to see details.',
      title: 'Car Sourcing',
      titleHighlight: 'Fully Turnkey',
      description:
        "We source cars in the country you're in or looking to buy from — full inspection, deal support, and delivery, fully turnkey. Choose a country to see details.",
      breadcrumbLabel: 'Car Sourcing',
      casesHeading: 'Sourcing Case Studies',
      chooseCountryLabel: 'Choose a country:',
      ctaLabel: 'Find My Car',
    },
    title: 'Full-Service Car Sourcing',
    descriptionFor: (location) =>
      `We'll find your car ${location} — sourced from cars already in the country, not shipped in from abroad. Full inspection, deal support, and delivery to your city — fully turnkey, customs clearance included.`,
    ctaLabel: 'Submit a Request',
    casesHeadingFor: (location) => `Case Studies: Car Sourcing ${location}`,
    breadcrumbLabelFor: (location) => `Cars ${location}`,
    stepsFor: (location) => [
      { n: '01', text: 'Submit your requirements — budget, make, mileage' },
      {
        n: '02',
        text: `We search for matches ${location} based on your criteria`,
      },
      { n: '03', text: 'An independent expert inspects the car in person' },
      {
        n: '04',
        text: 'We support the deal and help with paperwork and registration',
      },
      {
        n: '05',
        text: 'We deliver the car to your city — fully turnkey, customs clearance included',
      },
    ],
    deliveryLineFor: (destinations) =>
      `We deliver to ${destinations} — and any other country, just ask when you submit a request.`,
    deliveryDestinations: [
      'Russia',
      'Kazakhstan',
      'Kyrgyzstan',
      'Ukraine',
      'Belarus',
      'Bosnia and Herzegovina',
      'Croatia',
      'North Macedonia',
      'Turkey',
    ],
    citiesLabel: 'Cities:',
    alsoInLabel: 'Also sourcing in:',
    crossSellLabel: "Need a car that isn't local?",
  },
  'vehicle-buyback': {
    title: 'Car Buyback',
    ctaLabel: 'Get a Valuation',
    casesHeading: 'Buyback Case Studies',
    breadcrumbLabel: 'Car Buyback',
    descriptionSerbia:
      'We buy cars on Russian plates below market price — the car can be anywhere in Europe. We also buy cars on Serbian plates in Serbia and Montenegro. Online valuation, paperwork done in a day, payment the same day as the deal.',
    descriptionOtherFor: (name) =>
      `We buy cars on Russian plates below market price — the car can be anywhere in Europe, including ${name}. Online valuation, paperwork done in a day, payment the same day as the deal.`,
    step1: 'Send photos and a description of the car',
    step2:
      'We give an online valuation from photos within an hour — below market price',
    step3Serbia:
      'We meet for inspection — Russian plates (anywhere in Europe) or Serbian plates (Serbia, Montenegro)',
    step3Other:
      'We meet for inspection — Russian plates, the car can be anywhere in Europe',
    step4: 'We complete the deal — you get paid the day you sign',
  },
  'vehicle-import': {
    hub: {
      metaTitle: 'Turnkey Car Import from Europe and China',
      metaDescription:
        'We import cars from Germany, Spain, Switzerland, and China to any country — sourcing, inspection, delivery, and customs clearance, fully turnkey.',
      title: 'Car Import',
      titleHighlight: 'from Europe and China',
      description:
        'The car is in Europe or China — you can be anywhere. We source it, inspect it, and bring it to you, fully turnkey, customs clearance included.',
      breadcrumbLabel: 'Car Import',
      casesHeading: 'Import Case Studies',
      euCardTitle: 'From Europe',
      euCardText:
        'Spain, Switzerland, and more — sourced and delivered wherever you are.',
      chinaCardTitle: 'From China',
      chinaCardText:
        'New and used cars from China, delivered through a trusted logistics partner.',
      exploreLabel: 'Learn more',
      ctaLabel: 'Get an Import Quote',
    },
    de: {
      metaTitle: 'Cars from Germany — Turnkey Import',
      metaDescription:
        'We source and deliver cars from Germany — inspection, paperwork, and customs clearance, fully turnkey. Delivered to Serbia, Spain, and Portugal.',
      title: 'Cars from Germany',
      titleHighlight: 'Turnkey',
      description:
        'We source the car from Germany and deliver it to you, wherever you are: inspection, paperwork, and customs clearance, fully turnkey.',
      ctaLabel: 'Submit a Request',
      breadcrumbLabel: 'Cars from Germany',
      casesHeading: 'Case Studies: Cars from Germany',
      steps: [
        PRIVOZ_STEP_REQUEST_EN,
        vehicleImportStep02EN('Germany'),
        PRIVOZ_STEP_INSPECT_EN,
        PRIVOZ_STEP_EXPORT_EN,
        PRIVOZ_STEP_HANDOVER_EN,
      ],
      destinationsNote:
        'We deliver to Serbia, Spain, and Portugal — and anywhere else, just ask when you submit a request.',
      chinaCrossLabel: 'Considering a car from China?',
    },
    es: {
      metaTitle: 'Cars from Spain — Turnkey Import',
      metaDescription:
        'We source and deliver cars from Spain — inspection, paperwork, and customs clearance, fully turnkey. Delivered to Serbia and Portugal.',
      title: 'Cars from Spain',
      titleHighlight: 'Turnkey',
      description:
        'We source the car from Spain and deliver it to you, wherever you are: inspection, paperwork, and customs clearance, fully turnkey.',
      ctaLabel: 'Submit a Request',
      breadcrumbLabel: 'Cars from Spain',
      casesHeading: 'Case Studies: Cars from Spain',
      steps: [
        PRIVOZ_STEP_REQUEST_EN,
        vehicleImportStep02EN('Spain'),
        PRIVOZ_STEP_INSPECT_EN,
        PRIVOZ_STEP_EXPORT_EN,
        PRIVOZ_STEP_HANDOVER_EN,
      ],
      destinationsNote:
        'We deliver to Serbia and Portugal — and anywhere else, just ask when you submit a request.',
      chinaCrossLabel: 'Considering a car from China?',
    },
    ch: {
      metaTitle: 'Cars from Switzerland — Turnkey Import',
      metaDescription:
        'We source and deliver cars from Switzerland — inspection, paperwork, and customs clearance, fully turnkey. Delivered to Serbia, Spain, and Portugal.',
      title: 'Cars from Switzerland',
      titleHighlight: 'Turnkey',
      description:
        'We source the car from Switzerland and deliver it to you, wherever you are: inspection, paperwork, and customs clearance, fully turnkey.',
      ctaLabel: 'Submit a Request',
      breadcrumbLabel: 'Cars from Switzerland',
      casesHeading: 'Case Studies: Cars from Switzerland',
      steps: [
        PRIVOZ_STEP_REQUEST_EN,
        vehicleImportStep02EN('Switzerland'),
        PRIVOZ_STEP_INSPECT_EN,
        PRIVOZ_STEP_EXPORT_EN,
        PRIVOZ_STEP_HANDOVER_EN,
      ],
      destinationsNote:
        'We deliver to Serbia, Spain, and Portugal — and anywhere else, just ask when you submit a request.',
      chinaCrossLabel: 'Considering a car from China?',
    },
    eu: {
      metaTitle: 'Cars from Europe — Turnkey Import',
      metaDescription:
        'We source and deliver cars from any European country — Germany, Spain, Switzerland, and more — inspection, paperwork, and customs clearance, fully turnkey.',
      title: 'Cars from Europe',
      titleHighlight: 'Turnkey',
      description:
        'We source the car from Europe — Germany, Spain, Switzerland, and other European countries — and deliver it to you, wherever you are: inspection, paperwork, and customs clearance, fully turnkey.',
      ctaLabel: 'Submit a Request',
      breadcrumbLabel: 'Cars from Europe',
      casesHeading: 'Case Studies: Cars from Europe',
      steps: [
        PRIVOZ_STEP_REQUEST_EN,
        {
          n: '02',
          text: 'We search for a match from Europe — Germany, Spain, Switzerland, and other European countries',
        },
        PRIVOZ_STEP_INSPECT_EN,
        PRIVOZ_STEP_EXPORT_EN,
        PRIVOZ_STEP_HANDOVER_EN,
      ],
      sourceCountriesLabel: 'We source from:',
      sourceMoreLabel: 'and other European countries',
      destinationsNote:
        'We deliver to Serbia, Spain, and Portugal — and anywhere else, just ask when you submit a request.',
    },
    china: {
      metaTitle: 'Cars from China — Turnkey Import',
      metaDescription:
        'We arrange car import from China to any country through a trusted logistics partner — sourcing, paperwork, and customs clearance, fully turnkey.',
      title: 'Cars from China',
      titleHighlight: 'Turnkey',
      description:
        'We source the car from China and deliver it to you, wherever you are, directly through a trusted logistics partner, fully turnkey, customs clearance included.',
      ctaLabel: 'Submit a Request',
      breadcrumbLabel: 'Cars from China',
      casesHeading: 'Case Studies: Cars from China',
      steps: [
        PRIVOZ_STEP_REQUEST_EN,
        { n: '02', text: 'We search for a match from China to your criteria' },
        { n: '03', text: 'We inspect the car and handle export paperwork' },
        {
          n: '04',
          text: 'We arrange delivery to your city through our logistics partner',
        },
        PRIVOZ_STEP_HANDOVER_EN,
      ],
      deCrossLabel: 'Looking for a car from Germany?',
      destinationsNote:
        'We deliver to Serbia and Germany — and anywhere else, just ask when you submit a request.',
    },
  },
  'vehicle-inspection': {
    title: 'Car Inspection',
    description:
      'Independent car inspection before you buy. An expert visits in person, runs diagnostics, and sends a report — no obligation to purchase.',
    ctaLabel: 'Order an Inspection',
    casesHeading: 'Inspection Case Studies',
    breadcrumbLabel: 'Car Inspection',
    steps: [
      {
        n: '01',
        text: 'Body and paintwork — checking for prior repairs or accident damage',
      },
      { n: '02', text: 'Running gear, suspension, brakes' },
      { n: '03', text: 'Engine, gearbox, transmission' },
      { n: '04', text: 'Electronics and service history by VIN' },
      {
        n: '05',
        text: 'Legal status — liens, registration holds, accident history',
      },
    ],
    extraLine:
      'We also work in other European countries, including Portugal — ask when you submit a request.',
  },
  cityVehicleSourcing: {
    title: 'Car Sourcing',
    descriptionFor: (cityLocation, countryName) =>
      `We'll find your car ${cityLocation} with a full inspection. We cover all of ${countryName}.`,
    casesHeadingFor: (countryGenitiveOrName) =>
      `Case Studies from ${countryGenitiveOrName}`,
    whyCityHeadingFor: (cityName) => `Why ${cityName}`,
    reason1: 'A major car market for the region',
    reason2: 'Plenty of well-documented options',
    reason3For: (cityLocation) => `Our expert is based ${cityLocation}`,
    reason4Dekra: 'DEKRA / TÜV inspection available on request',
    reason4Generic: 'Independent technical inspection available on request',
    otherCitiesLabelFor: (countryLocation) =>
      `Other cities ${countryLocation}:`,
  },
  autoServiceBelgrade: {
    metaTitle: 'Auto Service in Belgrade — Repair and Maintenance',
    metaDescription:
      'Professional car repair and maintenance in Belgrade with a quality guarantee. Diagnostics, scheduled maintenance, suspension, engine, and transmission repair.',
    title: 'Auto Service',
    titleHighlight: 'in Belgrade',
    description:
      'Professional car repair and maintenance in Belgrade with a quality guarantee.',
    ctaLabel: 'Book a Service',
    breadcrumbLabel: 'Auto Service in Belgrade',
    whatWeDoHeading: 'What We Do',
    whatWeDo: [
      {
        key: 'diagnostics',
        label: 'Computer Diagnostics',
        desc: 'Finding faults with modern diagnostic equipment',
      },
      {
        key: 'maintenance',
        label: 'Scheduled Maintenance',
        desc: 'Oil, filter, and fluid changes',
      },
      {
        key: 'suspension',
        label: 'Suspension & Brakes',
        desc: 'Diagnostics and repair of the suspension, brakes, and steering',
      },
      {
        key: 'engine',
        label: 'Engine & Transmission',
        desc: 'Engine, transmission, and ancillary equipment repair',
      },
      {
        key: 'prepurchase',
        label: 'Pre-Purchase Inspection',
        desc: 'A full inspection before you buy a car or take it on a long trip',
      },
    ],
    commentLabel: 'Make, model, what needs doing',
    commentPlaceholder: 'BMW 320i, 2018, suspension noise…',
    alsoSourcingLabel: 'Also sourcing cars in:',
    howToFindHeading: 'How to Find Us',
    addressLabel: 'Service Address',
    streetAddress: 'Peka Pavlovića 39',
    cityCountryLine: 'Belgrade, Serbia',
    mapButtonLabel: 'Open in Google Maps',
    mapIframeTitle: 'Auto service on the map — Peka Pavlovića 39, Belgrade',
    worksHeading: 'Our Work',
  },
  detailingBelgrade: {
    metaTitle:
      'Detailing in Belgrade — Vinyl Wrapping for Cars, Motorcycles, Bicycles, Yachts',
    metaDescription:
      'Detailing in Belgrade: vinyl wrapping for cars, motorcycles, bicycles, and yachts.',
    title: 'Detailing',
    titleHighlight: 'in Belgrade',
    description:
      'Professional detailing in Belgrade: vinyl wrapping for cars, motorcycles, bicycles, and yachts.',
    ctaLabel: 'Leave a Request',
    breadcrumbLabel: 'Detailing in Belgrade',
    whatWeDoHeading: 'Our Services',
    whatWeDo: [
      {
        key: 'wrap',
        label: 'Vinyl Wrapping',
        desc: 'Full and partial body wrapping for cars, motorcycles, bicycles, and yachts with protective or decorative vinyl',
      },
    ],
    commentLabel: 'Make, model, what needs doing',
    commentPlaceholder: 'BMW X5, 2019, vinyl wrap…',
    alsoSourcingLabel: 'Also sourcing cars in:',
    howToFindHeading: 'How to Find Us',
    addressLabel: 'Address',
    streetAddress: 'Paštrovićeva 8',
    cityCountryLine: 'Belgrade, Serbia',
    mapButtonLabel: 'Open in Google Maps',
    mapIframeTitle: 'Detailing on the map — Paštrovićeva 8, Belgrade',
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
    channelBannerText:
      'We post new case studies, the sourcing process, and useful tips.',
    channelBannerCta: 'Subscribe',
    usefulInfoLabel: 'Useful Information',
    serviceBadges: {
      'vehicle-sourcing': 'Sourcing',
      'vehicle-buyback': 'Buyback',
      'vehicle-inspection': 'Inspection',
      'vehicle-import': 'Import',
      'auto-service-belgrade': 'Service',
      'detailing-belgrade': 'Detailing',
    },
  },
};

const PRIVOZ_STEP_REQUEST_SR = {
  n: '01',
  text: 'Ostavljate zahtev sa kriterijumima — budžet, marka, kilometraža',
};
const PRIVOZ_STEP_INSPECT_SR = {
  n: '03',
  text: 'Nezavisni stručnjak pregleda vozilo na licu mesta',
};
const PRIVOZ_STEP_EXPORT_SR = {
  n: '04',
  text: 'Sređujemo izvoznu dokumentaciju i organizujemo dovoz do vašeg grada',
};
const PRIVOZ_STEP_HANDOVER_SR = {
  n: '05',
  text: 'Carinjenje i predaja vozila — sve na ključ',
};
const vehicleImportStep02SR = (countryGenitive: string) => ({
  n: '02',
  text: `Tražimo vozilo iz ${countryGenitive} prema vašim kriterijumima`,
});

const sr: ServicesContent = {
  'vehicle-sourcing': {
    hub: {
      metaTitle: 'Kompletan odabir vozila na ključ — izaberite zemlju',
      metaDescription:
        'Biramo vozilo u Nemačkoj, Srbiji, Španiji, Švajcarskoj i Portugalu — potpuna provera, podrška tokom kupovine i dovoz na ključ. Izaberite zemlju da vidite detalje.',
      title: 'Odabir vozila',
      titleHighlight: 'na ključ',
      description:
        'Biramo vozilo u zemlji u kojoj se nalazite ili planirate kupovinu — potpuna provera, podrška tokom kupovine i dovoz na ključ. Izaberite zemlju da vidite detalje.',
      breadcrumbLabel: 'Odabir vozila',
      casesHeading: 'Primeri odabira vozila',
      chooseCountryLabel: 'Izaberite zemlju:',
      ctaLabel: 'Pronađite auto',
    },
    title: 'Kompletan odabir vozila',
    descriptionFor: (location) =>
      `Pronaći ćemo vozilo ${location} — biramo među vozilima koja su već u zemlji, ne dovozimo ih iz inostranstva. Potpuna provera, podrška tokom kupovine i dovoz do vašeg grada — sve na ključ, uključujući carinjenje.`,
    ctaLabel: 'Pošaljite zahtev',
    casesHeadingFor: (location) => `Primeri: odabir vozila ${location}`,
    breadcrumbLabelFor: (location) => `Vozila ${location}`,
    stepsFor: (location) => [
      {
        n: '01',
        text: 'Ostavljate zahtev sa kriterijumima — budžet, marka, kilometraža',
      },
      { n: '02', text: `Tražimo ponude ${location} prema vašim kriterijumima` },
      { n: '03', text: 'Nezavisni stručnjak pregleda i proverava vozilo' },
      {
        n: '04',
        text: 'Pratimo tok posla i pomažemo oko dokumentacije i registracije',
      },
      {
        n: '05',
        text: 'Dovozimo vozilo do vašeg grada — sve na ključ, uključujući carinjenje',
      },
    ],
    deliveryLineFor: (destinations) =>
      `Dostavljamo u ${destinations} — i u bilo koju drugu zemlju, dogovorite prilikom slanja zahteva.`,
    deliveryDestinations: [
      'Rusiju',
      'Kazahstan',
      'Kirgistan',
      'Ukrajinu',
      'Belorusiju',
      'Bosnu i Hercegovinu',
      'Hrvatsku',
      'Severnu Makedoniju',
      'Tursku',
    ],
    citiesLabel: 'Gradovi:',
    alsoInLabel: 'Takođe pronalazimo vozila i u:',
    crossSellLabel: 'Treba vam vozilo koje nije lokalno?',
  },
  'vehicle-buyback': {
    title: 'Otkup vozila',
    ctaLabel: 'Zatražite procenu',
    casesHeading: 'Primeri otkupa',
    breadcrumbLabel: 'Otkup vozila',
    descriptionSerbia:
      'Otkupljujemo vozila na ruskim tablicama ispod tržišne cene — vozilo može biti bilo gde u Evropi. Takođe otkupljujemo vozila na srpskim tablicama u Srbiji i Crnoj Gori. Procena onlajn, papirologija za 1 dan, isplata na dan dogovora.',
    descriptionOtherFor: (name) =>
      `Otkupljujemo vozila na ruskim tablicama ispod tržišne cene — vozilo može biti bilo gde u Evropi, uključujući ${name}. Procena onlajn, papirologija za 1 dan, isplata na dan dogovora.`,
    step1: 'Šaljete fotografije i opis vozila',
    step2:
      'Procenjujemo onlajn na osnovu fotografija za 1 sat — ispod tržišne cene',
    step3Serbia:
      'Dogovaramo pregled — ruske tablice (bilo gde u Evropi) ili srpske tablice (Srbija, Crna Gora)',
    step3Other:
      'Dogovaramo pregled — ruske tablice, vozilo može biti bilo gde u Evropi',
    step4: 'Sklapamo posao — novac dobijate na dan potpisivanja',
  },
  'vehicle-import': {
    hub: {
      metaTitle: 'Uvoz vozila iz Evrope i Kine na ključ',
      metaDescription:
        'Uvozimo vozila iz Nemačke, Španije, Švajcarske i Kine u bilo koju zemlju — odabir, provera, dovoz i carinjenje na ključ.',
      title: 'Uvoz vozila',
      titleHighlight: 'iz Evrope i Kine',
      description:
        'Vozilo je u Evropi ili Kini, vi ste bilo gde. Biramo ga, proveravamo i dovozimo do vas na ključ, uključujući carinjenje.',
      breadcrumbLabel: 'Uvoz vozila',
      casesHeading: 'Primeri uvoza',
      euCardTitle: 'Iz Evrope',
      euCardText:
        'Španija, Švajcarska i druge zemlje — odabir i dovoz bilo gde.',
      chinaCardTitle: 'Iz Kine',
      chinaCardText:
        'Nova i polovna vozila iz Kine — dovoz preko proverenog partnera.',
      exploreLabel: 'Saznajte više',
      ctaLabel: 'Zatražite ponudu za uvoz',
    },
    de: {
      metaTitle: 'Vozila iz Nemačke — uvoz na ključ',
      metaDescription:
        'Biramo i dovozimo vozila iz Nemačke — provera, papirologija i carinjenje na ključ. Dovozili smo u Srbiju, Španiju i Portugaliju.',
      title: 'Vozila iz Nemačke',
      titleHighlight: 'na ključ',
      description:
        'Vozilo biramo iz Nemačke i dovozimo do vas, gde god da ste: provera, papirologija i carinjenje na ključ.',
      ctaLabel: 'Pošaljite zahtev',
      breadcrumbLabel: 'Vozila iz Nemačke',
      casesHeading: 'Primeri: vozila iz Nemačke',
      steps: [
        PRIVOZ_STEP_REQUEST_SR,
        vehicleImportStep02SR('Nemačke'),
        PRIVOZ_STEP_INSPECT_SR,
        PRIVOZ_STEP_EXPORT_SR,
        PRIVOZ_STEP_HANDOVER_SR,
      ],
      destinationsNote:
        'Već smo dovozili u Srbiju, Španiju i Portugaliju — dovozimo i u bilo koju drugu zemlju, dogovorite prilikom slanja zahteva.',
      chinaCrossLabel: 'Razmatrate uvoz iz Kine?',
    },
    es: {
      metaTitle: 'Vozila iz Španije — uvoz na ključ',
      metaDescription:
        'Biramo i dovozimo vozila iz Španije — provera, papirologija i carinjenje na ključ. Dovozili smo u Srbiju i Portugaliju.',
      title: 'Vozila iz Španije',
      titleHighlight: 'na ključ',
      description:
        'Vozilo biramo iz Španije i dovozimo do vas, gde god da ste: provera, papirologija i carinjenje na ključ.',
      ctaLabel: 'Pošaljite zahtev',
      breadcrumbLabel: 'Vozila iz Španije',
      casesHeading: 'Primeri: vozila iz Španije',
      steps: [
        PRIVOZ_STEP_REQUEST_SR,
        vehicleImportStep02SR('Španije'),
        PRIVOZ_STEP_INSPECT_SR,
        PRIVOZ_STEP_EXPORT_SR,
        PRIVOZ_STEP_HANDOVER_SR,
      ],
      destinationsNote:
        'Dovozimo u Srbiju i Portugaliju — i u bilo koju drugu zemlju, dogovorite prilikom slanja zahteva.',
      chinaCrossLabel: 'Razmatrate uvoz iz Kine?',
    },
    ch: {
      metaTitle: 'Vozila iz Švajcarske — uvoz na ključ',
      metaDescription:
        'Biramo i dovozimo vozila iz Švajcarske — provera, papirologija i carinjenje na ključ. Dovozili smo u Srbiju, Španiju i Portugaliju.',
      title: 'Vozila iz Švajcarske',
      titleHighlight: 'na ključ',
      description:
        'Vozilo biramo iz Švajcarske i dovozimo do vas, gde god da ste: provera, papirologija i carinjenje na ključ.',
      ctaLabel: 'Pošaljite zahtev',
      breadcrumbLabel: 'Vozila iz Švajcarske',
      casesHeading: 'Primeri: vozila iz Švajcarske',
      steps: [
        PRIVOZ_STEP_REQUEST_SR,
        vehicleImportStep02SR('Švajcarske'),
        PRIVOZ_STEP_INSPECT_SR,
        PRIVOZ_STEP_EXPORT_SR,
        PRIVOZ_STEP_HANDOVER_SR,
      ],
      destinationsNote:
        'Dovozimo u Srbiju, Španiju i Portugaliju — i u bilo koju drugu zemlju, dogovorite prilikom slanja zahteva.',
      chinaCrossLabel: 'Razmatrate uvoz iz Kine?',
    },
    eu: {
      metaTitle: 'Vozila iz Evrope — uvoz na ključ',
      metaDescription:
        'Biramo i dovozimo vozila iz bilo koje evropske zemlje — Nemačka, Španija, Švajcarska i druge — provera, papirologija i carinjenje na ključ.',
      title: 'Vozila iz Evrope',
      titleHighlight: 'na ključ',
      description:
        'Vozilo biramo iz Evrope — Nemačka, Španija, Švajcarska i druge evropske zemlje — i dovozimo do vas, gde god da ste: provera, papirologija i carinjenje na ključ.',
      ctaLabel: 'Pošaljite zahtev',
      breadcrumbLabel: 'Vozila iz Evrope',
      casesHeading: 'Primeri: vozila iz Evrope',
      steps: [
        PRIVOZ_STEP_REQUEST_SR,
        {
          n: '02',
          text: 'Tražimo vozilo iz Evrope — Nemačka, Španija, Švajcarska i druge evropske zemlje',
        },
        PRIVOZ_STEP_INSPECT_SR,
        PRIVOZ_STEP_EXPORT_SR,
        PRIVOZ_STEP_HANDOVER_SR,
      ],
      sourceCountriesLabel: 'Dovozimo iz:',
      sourceMoreLabel: 'i druge evropske zemlje',
      destinationsNote:
        'Dovozimo u Srbiju, Španiju i Portugaliju — i u bilo koju drugu zemlju, dogovorite prilikom slanja zahteva.',
    },
    china: {
      metaTitle: 'Vozila iz Kine — uvoz na ključ',
      metaDescription:
        'Organizujemo uvoz vozila iz Kine u bilo koju zemlju preko proverenog logističkog partnera — odabir, papirologija i carinjenje na ključ.',
      title: 'Vozila iz Kine',
      titleHighlight: 'na ključ',
      description:
        'Vozilo biramo iz Kine i dovozimo do vas, gde god da ste, direktno preko proverenog logističkog partnera, na ključ, uključujući carinjenje.',
      ctaLabel: 'Pošaljite zahtev',
      breadcrumbLabel: 'Vozila iz Kine',
      casesHeading: 'Primeri: vozila iz Kine',
      steps: [
        PRIVOZ_STEP_REQUEST_SR,
        { n: '02', text: 'Tražimo vozilo iz Kine prema vašim kriterijumima' },
        {
          n: '03',
          text: 'Proveravamo vozilo i sređujemo izvoznu dokumentaciju',
        },
        {
          n: '04',
          text: 'Organizujemo dovoz do vašeg grada preko logističkog partnera',
        },
        PRIVOZ_STEP_HANDOVER_SR,
      ],
      deCrossLabel: 'Tražite vozilo iz Nemačke?',
      destinationsNote:
        'Dovozimo u Srbiju i Nemačku — i u bilo koju drugu zemlju, dogovorite prilikom slanja zahteva.',
    },
  },
  'vehicle-inspection': {
    title: 'Provera vozila',
    description:
      'Nezavisna provera vozila pre kupovine. Stručnjak izlazi na teren, radi dijagnostiku i šalje izveštaj — bez obaveze kupovine.',
    ctaLabel: 'Naručite proveru',
    casesHeading: 'Primeri provere',
    breadcrumbLabel: 'Provera vozila',
    steps: [
      {
        n: '01',
        text: 'Karoserija i lak — provera prethodnih popravki ili udesa',
      },
      { n: '02', text: 'Mehanika, vešanje, kočnice' },
      { n: '03', text: 'Motor, menjač, transmisija' },
      { n: '04', text: 'Elektronika i istorija održavanja po VIN broju' },
      { n: '05', text: 'Pravna čistoća — zaloga, zabrana registracije, udesi' },
    ],
    extraLine:
      'Radimo i u drugim evropskim zemljama, uključujući Portugaliju — proverite prilikom slanja zahteva.',
  },
  cityVehicleSourcing: {
    title: 'Odabir vozila',
    descriptionFor: (cityLocation, countryName) =>
      `Pronaći ćemo vozilo ${cityLocation} uz potpunu proveru. Radimo širom ${countryName}.`,
    casesHeadingFor: (countryGenitiveOrName) =>
      `Primeri iz ${countryGenitiveOrName}`,
    whyCityHeadingFor: (cityName) => `Zašto ${cityName}`,
    reason1: 'Veliko tržište vozila u regionu',
    reason2: 'Mnogo ponuda sa urednom istorijom',
    reason3For: (cityLocation) => `Naš stručnjak je ${cityLocation}`,
    reason4Dekra: 'DEKRA / TÜV provera na zahtev',
    reason4Generic: 'Nezavisna tehnička provera na zahtev',
    otherCitiesLabelFor: (countryLocation) =>
      `Drugi gradovi ${countryLocation}:`,
  },
  autoServiceBelgrade: {
    metaTitle: 'Auto servis u Beogradu — popravka i održavanje',
    metaDescription:
      'Profesionalna popravka i održavanje vozila u Beogradu uz garanciju kvaliteta. Dijagnostika, redovno servisiranje, popravka vešanja, motora i transmisije.',
    title: 'Auto servis',
    titleHighlight: 'u Beogradu',
    description:
      'Profesionalna popravka i održavanje vozila u Beogradu uz garanciju kvaliteta.',
    ctaLabel: 'Zakažite servis',
    breadcrumbLabel: 'Auto servis u Beogradu',
    whatWeDoHeading: 'Šta radimo',
    whatWeDo: [
      {
        key: 'diagnostics',
        label: 'Kompjuterska dijagnostika',
        desc: 'Pronalaženje kvarova savremenom dijagnostičkom opremom',
      },
      {
        key: 'maintenance',
        label: 'Redovno servisiranje',
        desc: 'Zamena ulja, filtera i tehničkih tečnosti',
      },
      {
        key: 'suspension',
        label: 'Vešanje i kočnice',
        desc: 'Dijagnostika i popravka vešanja, kočionog sistema i upravljača',
      },
      {
        key: 'engine',
        label: 'Motor i transmisija',
        desc: 'Popravka motora, transmisije i prateće opreme',
      },
      {
        key: 'prepurchase',
        label: 'Provera pre kupovine',
        desc: 'Kompletna provera vozila pre kupovine ili duže vožnje',
      },
    ],
    commentLabel: 'Marka, model, šta treba uraditi',
    commentPlaceholder: 'BMW 320i, 2018, kucanje u vešanju…',
    alsoSourcingLabel: 'Takođe pronalazimo vozila i u:',
    howToFindHeading: 'Kako nas pronaći',
    addressLabel: 'Adresa servisa',
    streetAddress: 'Peka Pavlovića 39',
    cityCountryLine: 'Beograd, Srbija',
    mapButtonLabel: 'Otvorite u Google mapama',
    mapIframeTitle: 'Auto servis na mapi — Peka Pavlovića 39, Beograd',
    worksHeading: 'Primeri radova',
  },
  detailingBelgrade: {
    metaTitle:
      'Detailing u Beogradu — folijacija automobila, motocikala, bicikala, jahti',
    metaDescription:
      'Detailing u Beogradu: folijacija automobila, motocikala, bicikala i jahti.',
    title: 'Detailing',
    titleHighlight: 'u Beogradu',
    description:
      'Profesionalni detailing u Beogradu: folijacija automobila, motocikala, bicikala i jahti.',
    ctaLabel: 'Pošaljite zahtev',
    breadcrumbLabel: 'Detailing u Beogradu',
    whatWeDoHeading: 'Naše usluge',
    whatWeDo: [
      {
        key: 'wrap',
        label: 'Folijacija',
        desc: 'Potpuna i delimična folijacija karoserije automobila, motocikala, bicikala i jahti zaštitnom ili dekorativnom folijom',
      },
    ],
    commentLabel: 'Marka, model, šta treba uraditi',
    commentPlaceholder: 'BMW X5, 2019, folijacija…',
    alsoSourcingLabel: 'Takođe pronalazimo vozila i u:',
    howToFindHeading: 'Kako nas pronaći',
    addressLabel: 'Adresa',
    streetAddress: 'Paštrovićeva 8',
    cityCountryLine: 'Beograd, Srbija',
    mapButtonLabel: 'Otvorite u Google mapama',
    mapIframeTitle: 'Detailing na mapi — Paštrovićeva 8, Beograd',
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
    channelBannerText:
      'Objavljujemo nove primere, proces odabira i korisne savete.',
    channelBannerCta: 'Pratite nas',
    usefulInfoLabel: 'Korisne informacije',
    serviceBadges: {
      'vehicle-sourcing': 'Odabir',
      'vehicle-buyback': 'Otkup',
      'vehicle-inspection': 'Provera',
      'vehicle-import': 'Uvoz',
      'auto-service-belgrade': 'Servis',
      'detailing-belgrade': 'Detailing',
    },
  },
};

const PRIVOZ_STEP_REQUEST_ES = {
  n: '01',
  text: 'Envías tus requisitos — presupuesto, marca, kilometraje',
};
const PRIVOZ_STEP_INSPECT_ES = {
  n: '03',
  text: 'Un experto independiente inspecciona el coche en el lugar',
};
const PRIVOZ_STEP_EXPORT_ES = {
  n: '04',
  text: 'Gestionamos la documentación de exportación y organizamos la entrega hasta tu ciudad',
};
const PRIVOZ_STEP_HANDOVER_ES = {
  n: '05',
  text: 'Despacho de aduana y entrega del coche — todo llave en mano',
};
const vehicleImportStep02ES = (countryName: string) => ({
  n: '02',
  text: `Buscamos tu coche en ${countryName} según tus criterios`,
});

const es: ServicesContent = {
  'vehicle-sourcing': {
    hub: {
      metaTitle: 'Búsqueda de coches llave en mano — elige tu país',
      metaDescription:
        'Buscamos coches en Alemania, Serbia, España, Suiza y Portugal — inspección completa, acompañamiento de la compra y entrega llave en mano. Elige el país de búsqueda.',
      title: 'Búsqueda de coches',
      titleHighlight: 'llave en mano',
      description:
        'Buscamos el coche en el país donde estás o donde planeas comprarlo — inspección completa, acompañamiento de la compra y entrega llave en mano. Elige un país para ver los detalles.',
      breadcrumbLabel: 'Búsqueda de coches',
      casesHeading: 'Casos de búsqueda de coches',
      chooseCountryLabel: 'Elige un país:',
      ctaLabel: 'Buscar mi coche',
    },
    title: 'Búsqueda de coches llave en mano',
    descriptionFor: (location) =>
      `Encontraremos tu coche ${location} — entre coches que ya están en el país, sin traerlos desde el extranjero. Inspección completa, acompañamiento de la compra y entrega hasta tu ciudad — llave en mano, aduana incluida.`,
    ctaLabel: 'Enviar solicitud',
    casesHeadingFor: (location) => `Casos: búsqueda de coches ${location}`,
    breadcrumbLabelFor: (location) => `Coches ${location}`,
    stepsFor: (location) => [
      {
        n: '01',
        text: 'Envías tus requisitos — presupuesto, marca, kilometraje',
      },
      { n: '02', text: `Buscamos opciones ${location} según tus criterios` },
      {
        n: '03',
        text: 'Un experto independiente inspecciona el coche en persona',
      },
      {
        n: '04',
        text: 'Acompañamos la compra y te ayudamos con la documentación y el papeleo',
      },
      {
        n: '05',
        text: 'Entregamos el coche en tu ciudad — llave en mano, aduana incluida',
      },
    ],
    deliveryLineFor: (destinations) =>
      `Entregamos en ${destinations} — y en cualquier otro país, coordínalo al enviar la solicitud.`,
    deliveryDestinations: [
      'Rusia',
      'Kazajistán',
      'Kirguistán',
      'Ucrania',
      'Bielorrusia',
      'Bosnia y Herzegovina',
      'Croacia',
      'Macedonia del Norte',
      'Turquía',
    ],
    citiesLabel: 'Ciudades:',
    alsoInLabel: 'También buscamos coches en:',
    crossSellLabel: '¿Necesitas un coche que no sea local?',
  },
  'vehicle-buyback': {
    title: 'Compra de tu coche',
    ctaLabel: 'Solicitar valoración',
    casesHeading: 'Casos de compra de coches',
    breadcrumbLabel: 'Compra de tu coche',
    descriptionSerbia:
      'Compramos coches con matrícula rusa por debajo del precio de mercado — el coche puede estar en cualquier país de Europa. También compramos coches con matrícula serbia en Serbia y Montenegro. Valoración online, papeleo en 1 día, pago el mismo día del acuerdo.',
    descriptionOtherFor: (name) =>
      `Compramos coches con matrícula rusa por debajo del precio de mercado — el coche puede estar en cualquier país de Europa, incluido ${name}. Valoración online, papeleo en 1 día, pago el mismo día del acuerdo.`,
    step1: 'Envías fotos y una descripción del coche',
    step2:
      'Hacemos una valoración online a partir de las fotos en 1 hora — por debajo del precio de mercado',
    step3Serbia:
      'Nos reunimos para la inspección — matrícula rusa (en cualquier país de Europa) o matrícula serbia (Serbia, Montenegro)',
    step3Other:
      'Nos reunimos para la inspección — matrícula rusa, el coche puede estar en cualquier país de Europa',
    step4: 'Cerramos el trato — cobras el mismo día de la firma',
  },
  'vehicle-import': {
    hub: {
      metaTitle: 'Importación de coches desde Europa y China, llave en mano',
      metaDescription:
        'Importamos coches desde Alemania, España, Suiza y China a cualquier país — búsqueda, inspección, entrega y despacho de aduana, llave en mano.',
      title: 'Importación de coches',
      titleHighlight: 'desde Europa y China',
      description:
        'El coche está en Europa o en China, tú puedes estar donde sea. Lo buscamos, lo inspeccionamos y te lo traemos llave en mano, aduana incluida.',
      breadcrumbLabel: 'Importación de coches',
      casesHeading: 'Casos de importación',
      euCardTitle: 'Desde Europa',
      euCardText:
        'España, Suiza y otros países — búsqueda y entrega a cualquier destino.',
      chinaCardTitle: 'Desde China',
      chinaCardText:
        'Coches nuevos y usados desde China, entregados a través de un socio logístico de confianza.',
      exploreLabel: 'Saber más',
      ctaLabel: 'Calcular importación',
    },
    de: {
      metaTitle: 'Coches desde Alemania — importación llave en mano',
      metaDescription:
        'Buscamos y entregamos coches desde Alemania — inspección, papeleo y despacho de aduana, llave en mano. Hemos entregado en Serbia, España y Portugal.',
      title: 'Coches desde Alemania',
      titleHighlight: 'llave en mano',
      description:
        'Buscamos el coche en Alemania y te lo entregamos donde estés: inspección, papeleo y despacho de aduana, llave en mano.',
      ctaLabel: 'Enviar solicitud',
      breadcrumbLabel: 'Coches desde Alemania',
      casesHeading: 'Casos: coches desde Alemania',
      steps: [
        PRIVOZ_STEP_REQUEST_ES,
        vehicleImportStep02ES('Alemania'),
        PRIVOZ_STEP_INSPECT_ES,
        PRIVOZ_STEP_EXPORT_ES,
        PRIVOZ_STEP_HANDOVER_ES,
      ],
      destinationsNote:
        'Entregamos en Serbia, España y Portugal — y en cualquier otro país, coordínalo al enviar la solicitud.',
      chinaCrossLabel: '¿Te interesa un coche desde China?',
    },
    es: {
      metaTitle: 'Coches desde España — importación llave en mano',
      metaDescription:
        'Buscamos y entregamos coches desde España — inspección, papeleo y despacho de aduana, llave en mano. Hemos entregado en Serbia y Portugal.',
      title: 'Coches desde España',
      titleHighlight: 'llave en mano',
      description:
        'Buscamos el coche en España y te lo entregamos donde estés: inspección, papeleo y despacho de aduana, llave en mano.',
      ctaLabel: 'Enviar solicitud',
      breadcrumbLabel: 'Coches desde España',
      casesHeading: 'Casos: coches desde España',
      steps: [
        PRIVOZ_STEP_REQUEST_ES,
        vehicleImportStep02ES('España'),
        PRIVOZ_STEP_INSPECT_ES,
        PRIVOZ_STEP_EXPORT_ES,
        PRIVOZ_STEP_HANDOVER_ES,
      ],
      destinationsNote:
        'Entregamos en Serbia y Portugal — y en cualquier otro país, coordínalo al enviar la solicitud.',
      chinaCrossLabel: '¿Te interesa un coche desde China?',
    },
    ch: {
      metaTitle: 'Coches desde Suiza — importación llave en mano',
      metaDescription:
        'Buscamos y entregamos coches desde Suiza — inspección, papeleo y despacho de aduana, llave en mano. Hemos entregado en Serbia, España y Portugal.',
      title: 'Coches desde Suiza',
      titleHighlight: 'llave en mano',
      description:
        'Buscamos el coche en Suiza y te lo entregamos donde estés: inspección, papeleo y despacho de aduana, llave en mano.',
      ctaLabel: 'Enviar solicitud',
      breadcrumbLabel: 'Coches desde Suiza',
      casesHeading: 'Casos: coches desde Suiza',
      steps: [
        PRIVOZ_STEP_REQUEST_ES,
        vehicleImportStep02ES('Suiza'),
        PRIVOZ_STEP_INSPECT_ES,
        PRIVOZ_STEP_EXPORT_ES,
        PRIVOZ_STEP_HANDOVER_ES,
      ],
      destinationsNote:
        'Entregamos en Serbia, España y Portugal — y en cualquier otro país, coordínalo al enviar la solicitud.',
      chinaCrossLabel: '¿Te interesa un coche desde China?',
    },
    eu: {
      metaTitle: 'Coches desde Europa — importación llave en mano',
      metaDescription:
        'Buscamos y entregamos coches desde cualquier país europeo — Alemania, España, Suiza y otros — inspección, papeleo y despacho de aduana, llave en mano.',
      title: 'Coches desde Europa',
      titleHighlight: 'llave en mano',
      description:
        'Buscamos el coche en Europa — Alemania, España, Suiza y otros países europeos — y te lo entregamos donde estés: inspección, papeleo y despacho de aduana, llave en mano.',
      ctaLabel: 'Enviar solicitud',
      breadcrumbLabel: 'Coches desde Europa',
      casesHeading: 'Casos: coches desde Europa',
      steps: [
        PRIVOZ_STEP_REQUEST_ES,
        {
          n: '02',
          text: 'Buscamos el coche en Europa — Alemania, España, Suiza y otros países europeos',
        },
        PRIVOZ_STEP_INSPECT_ES,
        PRIVOZ_STEP_EXPORT_ES,
        PRIVOZ_STEP_HANDOVER_ES,
      ],
      sourceCountriesLabel: 'Importamos desde:',
      sourceMoreLabel: 'y otros países europeos',
      destinationsNote:
        'Entregamos en Serbia, España y Portugal — y en cualquier otro país, coordínalo al enviar la solicitud.',
    },
    china: {
      metaTitle: 'Coches desde China — importación llave en mano',
      metaDescription:
        'Organizamos la importación de coches desde China a cualquier país a través de un socio logístico de confianza — búsqueda, papeleo y despacho de aduana, llave en mano.',
      title: 'Coches desde China',
      titleHighlight: 'llave en mano',
      description:
        'Buscamos el coche en China y te lo entregamos donde estés, directamente a través de un socio logístico de confianza, llave en mano, aduana incluida.',
      ctaLabel: 'Enviar solicitud',
      breadcrumbLabel: 'Coches desde China',
      casesHeading: 'Casos: coches desde China',
      steps: [
        PRIVOZ_STEP_REQUEST_ES,
        { n: '02', text: 'Buscamos el coche en China según tus criterios' },
        {
          n: '03',
          text: 'Inspeccionamos el coche y gestionamos el papeleo de exportación',
        },
        {
          n: '04',
          text: 'Organizamos la entrega hasta tu ciudad a través de nuestro socio logístico',
        },
        PRIVOZ_STEP_HANDOVER_ES,
      ],
      deCrossLabel: '¿Buscas un coche desde Alemania?',
      destinationsNote:
        'Entregamos en Serbia y Alemania — y en cualquier otro país, coordínalo al enviar la solicitud.',
    },
  },
  'vehicle-inspection': {
    title: 'Inspección de coches',
    description:
      'Inspección independiente del coche antes de comprarlo. Un experto se desplaza, realiza un diagnóstico y entrega un informe — sin obligación de compra.',
    ctaLabel: 'Solicitar inspección',
    casesHeading: 'Casos de inspección',
    breadcrumbLabel: 'Inspección de coches',
    steps: [
      {
        n: '01',
        text: 'Carrocería y pintura — comprobación de reparaciones o daños por accidente',
      },
      { n: '02', text: 'Tren de rodaje, suspensión, frenos' },
      { n: '03', text: 'Motor, caja de cambios, transmisión' },
      { n: '04', text: 'Electrónica e historial de mantenimiento por VIN' },
      {
        n: '05',
        text: 'Situación legal — embargos, restricciones de matriculación, accidentes',
      },
    ],
    extraLine:
      'También trabajamos en otros países de Europa, incluido Portugal — pregúntanos al enviar la solicitud.',
  },
  cityVehicleSourcing: {
    title: 'Búsqueda de coches',
    descriptionFor: (cityLocation, countryName) =>
      `Encontraremos tu coche ${cityLocation} con una inspección completa. Trabajamos en toda la región de ${countryName}.`,
    casesHeadingFor: (countryGenitiveOrName) =>
      `Casos de ${countryGenitiveOrName}`,
    whyCityHeadingFor: (cityName) => `Por qué ${cityName}`,
    reason1: 'Un mercado de coches importante en la región',
    reason2: 'Muchas opciones con buen historial',
    reason3For: (cityLocation) => `Nuestro experto está ${cityLocation}`,
    reason4Dekra: 'Inspección DEKRA / TÜV disponible bajo petición',
    reason4Generic: 'Inspección técnica independiente disponible bajo petición',
    otherCitiesLabelFor: (countryLocation) =>
      `Otras ciudades ${countryLocation}:`,
  },
  autoServiceBelgrade: {
    metaTitle: 'Taller mecánico en Belgrado — reparación y mantenimiento',
    metaDescription:
      'Reparación y mantenimiento profesional de coches en Belgrado con garantía de calidad. Diagnóstico, mantenimiento, reparación de suspensión, motor y transmisión.',
    title: 'Taller mecánico',
    titleHighlight: 'en Belgrado',
    description:
      'Reparación y mantenimiento profesional de coches en Belgrado con garantía de calidad.',
    ctaLabel: 'Reservar cita',
    breadcrumbLabel: 'Taller mecánico en Belgrado',
    whatWeDoHeading: 'Qué hacemos',
    whatWeDo: [
      {
        key: 'diagnostics',
        label: 'Diagnóstico computarizado',
        desc: 'Localización de averías con equipos de diagnóstico modernos',
      },
      {
        key: 'maintenance',
        label: 'Mantenimiento programado',
        desc: 'Cambio de aceites, filtros y líquidos técnicos',
      },
      {
        key: 'suspension',
        label: 'Suspensión y frenos',
        desc: 'Diagnóstico y reparación de suspensión, sistema de frenos y dirección',
      },
      {
        key: 'engine',
        label: 'Motor y transmisión',
        desc: 'Reparación de motor, transmisión y equipos auxiliares',
      },
      {
        key: 'prepurchase',
        label: 'Inspección previa a la compra',
        desc: 'Revisión completa del coche antes de comprarlo o de un viaje largo',
      },
    ],
    commentLabel: 'Marca, modelo, qué necesitas',
    commentPlaceholder: 'BMW 320i, 2018, ruido en la suspensión…',
    alsoSourcingLabel: 'También buscamos coches en:',
    howToFindHeading: 'Cómo encontrarnos',
    addressLabel: 'Dirección del taller',
    streetAddress: 'Peka Pavlovića 39',
    cityCountryLine: 'Belgrado, Serbia',
    mapButtonLabel: 'Abrir en Google Maps',
    mapIframeTitle: 'Taller mecánico en el mapa — Peka Pavlovića 39, Belgrado',
    worksHeading: 'Ejemplos de trabajos',
  },
  detailingBelgrade: {
    metaTitle:
      'Detailing en Belgrado — vinilos para coches, motos, bicicletas y yates',
    metaDescription:
      'Detailing en Belgrado: vinilos para coches, motos, bicicletas y yates.',
    title: 'Detailing',
    titleHighlight: 'en Belgrado',
    description:
      'Detailing profesional en Belgrado: vinilos para coches, motos, bicicletas y yates.',
    ctaLabel: 'Enviar solicitud',
    breadcrumbLabel: 'Detailing en Belgrado',
    whatWeDoHeading: 'Nuestros servicios',
    whatWeDo: [
      {
        key: 'wrap',
        label: 'Vinilado',
        desc: 'Vinilado total o parcial de la carrocería de coches, motos, bicicletas y yates con láminas protectoras o decorativas',
      },
    ],
    commentLabel: 'Marca, modelo, qué necesitas',
    commentPlaceholder: 'BMW X5, 2019, vinilado…',
    alsoSourcingLabel: 'También buscamos coches en:',
    howToFindHeading: 'Cómo encontrarnos',
    addressLabel: 'Dirección',
    streetAddress: 'Paštrovićeva 8',
    cityCountryLine: 'Belgrado, Serbia',
    mapButtonLabel: 'Abrir en Google Maps',
    mapIframeTitle: 'Detailing en el mapa — Paštrovićeva 8, Belgrado',
    worksHeading: 'Ejemplos de trabajos',
  },
  caseChrome: {
    autoLabel: 'Coche',
    yearLabel: 'Año',
    priceLabel: 'Precio',
    realCaseFallback: 'Un caso real.',
    ctaEyebrow: '¿Necesitas el mismo servicio?',
    ctaHeading: 'Hablemos de tu coche',
    ctaButtonLabel: 'Escribir por Telegram',
    whatsappButtonLabel: 'Escribir por WhatsApp',
    viberButtonLabel: 'Escribir por Viber',
    callbackButtonLabel: 'Solicitar llamada',
    callbackShortLabel: 'Llamada',
    callButtonLabel: 'Llamar',
    channelBannerTitle: 'Más casos reales',
    channelBannerText:
      'Publicamos nuevos casos, el proceso de búsqueda y consejos útiles.',
    channelBannerCta: 'Suscribirse',
    usefulInfoLabel: 'Información útil',
    serviceBadges: {
      'vehicle-sourcing': 'Búsqueda',
      'vehicle-buyback': 'Compra',
      'vehicle-inspection': 'Inspección',
      'vehicle-import': 'Importación',
      'auto-service-belgrade': 'Taller',
      'detailing-belgrade': 'Detailing',
    },
  },
};

const PRIVOZ_STEP_REQUEST_DE = {
  n: '01',
  text: 'Sie senden uns Ihre Anforderungen — Budget, Marke, Kilometerstand',
};
const PRIVOZ_STEP_INSPECT_DE = {
  n: '03',
  text: 'Ein unabhängiger Experte prüft das Fahrzeug vor Ort',
};
const PRIVOZ_STEP_EXPORT_DE = {
  n: '04',
  text: 'Wir erledigen die Exportunterlagen und organisieren die Lieferung in Ihre Stadt',
};
const PRIVOZ_STEP_HANDOVER_DE = {
  n: '05',
  text: 'Verzollung und Übergabe des Fahrzeugs — alles als Komplettpaket',
};
const vehicleImportStep02DE = (countryName: string) => ({
  n: '02',
  text: `Wir suchen ein Fahrzeug aus ${countryName} nach Ihren Kriterien`,
});

const de: ServicesContent = {
  'vehicle-sourcing': {
    hub: {
      metaTitle: 'Fahrzeugsuche zum Komplettpreis — Land wählen',
      metaDescription:
        'Wir suchen Fahrzeuge in Deutschland, Serbien, Spanien, der Schweiz und Portugal — vollständige Prüfung, Begleitung des Kaufs und Lieferung als Komplettpaket. Wählen Sie Ihr Suchland.',
      title: 'Fahrzeugsuche',
      titleHighlight: 'zum Komplettpreis',
      description:
        'Wir suchen Ihr Fahrzeug in dem Land, in dem Sie sich befinden oder kaufen möchten — vollständige Prüfung, Begleitung des Kaufs und Lieferung als Komplettpaket. Wählen Sie ein Land, um die Details zu sehen.',
      breadcrumbLabel: 'Fahrzeugsuche',
      casesHeading: 'Beispiele der Fahrzeugsuche',
      chooseCountryLabel: 'Land wählen:',
      ctaLabel: 'Fahrzeug finden',
    },
    title: 'Fahrzeugsuche zum Komplettpreis',
    descriptionFor: (location) =>
      `Wir finden Ihr Fahrzeug ${location} — aus Fahrzeugen, die sich bereits im Land befinden, ohne Import aus dem Ausland. Vollständige Prüfung, Begleitung des Kaufs und Lieferung in Ihre Stadt — als Komplettpaket, inklusive Verzollung.`,
    ctaLabel: 'Anfrage senden',
    casesHeadingFor: (location) => `Beispiele: Fahrzeugsuche ${location}`,
    breadcrumbLabelFor: (location) => `Fahrzeuge ${location}`,
    stepsFor: (location) => [
      {
        n: '01',
        text: 'Sie senden uns Ihre Anforderungen — Budget, Marke, Kilometerstand',
      },
      { n: '02', text: `Wir suchen Angebote ${location} nach Ihren Kriterien` },
      {
        n: '03',
        text: 'Ein unabhängiger Experte prüft das Fahrzeug persönlich',
      },
      {
        n: '04',
        text: 'Wir begleiten den Kauf und helfen bei Unterlagen und Anmeldung',
      },
      {
        n: '05',
        text: 'Wir liefern das Fahrzeug in Ihre Stadt — als Komplettpaket, inklusive Verzollung',
      },
    ],
    deliveryLineFor: (destinations) =>
      `Lieferung ist auch möglich in folgende Länder: ${destinations} — sowie in jedes andere Land, sprechen Sie uns bei der Anfrage darauf an.`,
    deliveryDestinations: [
      'Russland',
      'Kasachstan',
      'Kirgisistan',
      'Ukraine',
      'Belarus',
      'Bosnien und Herzegowina',
      'Kroatien',
      'Nordmazedonien',
      'Türkei',
    ],
    citiesLabel: 'Städte:',
    alsoInLabel: 'Wir suchen auch Fahrzeuge in:',
    crossSellLabel: 'Brauchen Sie ein Fahrzeug, das nicht lokal ist?',
  },
  'vehicle-buyback': {
    title: 'Fahrzeugankauf',
    ctaLabel: 'Bewertung anfordern',
    casesHeading: 'Beispiele des Ankaufs',
    breadcrumbLabel: 'Fahrzeugankauf',
    descriptionSerbia:
      'Wir kaufen Fahrzeuge mit russischem Kennzeichen unter Marktpreis an — das Fahrzeug kann sich in jedem Land Europas befinden. Wir kaufen auch Fahrzeuge mit serbischem Kennzeichen in Serbien und Montenegro an. Online-Bewertung, Abwicklung in 1 Tag, Auszahlung am Tag des Geschäfts.',
    descriptionOtherFor: (name) =>
      `Wir kaufen Fahrzeuge mit russischem Kennzeichen unter Marktpreis an — das Fahrzeug kann sich in jedem Land Europas befinden, einschließlich ${name}. Online-Bewertung, Abwicklung in 1 Tag, Auszahlung am Tag des Geschäfts.`,
    step1: 'Sie senden Fotos und eine Beschreibung des Fahrzeugs',
    step2:
      'Wir erstellen anhand der Fotos innerhalb einer Stunde eine Online-Bewertung — unter Marktpreis',
    step3Serbia:
      'Wir vereinbaren eine Besichtigung — russisches Kennzeichen (in jedem Land Europas) oder serbisches Kennzeichen (Serbien, Montenegro)',
    step3Other:
      'Wir vereinbaren eine Besichtigung — russisches Kennzeichen, das Fahrzeug kann sich in jedem Land Europas befinden',
    step4:
      'Wir schließen das Geschäft ab — Sie erhalten das Geld am Tag der Unterschrift',
  },
  'vehicle-import': {
    hub: {
      metaTitle: 'Kompletter Fahrzeugimport aus Europa und China',
      metaDescription:
        'Wir importieren Fahrzeuge aus Deutschland, Spanien, der Schweiz und China in jedes Land — Beschaffung, Prüfung, Lieferung und Verzollung als Komplettpaket.',
      title: 'Fahrzeugimport',
      titleHighlight: 'aus Europa und China',
      description:
        'Das Fahrzeug steht in Europa oder China, Sie können überall sein. Wir suchen es aus, prüfen es und liefern es Ihnen als Komplettpaket, inklusive Verzollung.',
      breadcrumbLabel: 'Fahrzeugimport',
      casesHeading: 'Beispiele des Imports',
      euCardTitle: 'Aus Europa',
      euCardText:
        'Spanien, die Schweiz und weitere Länder — Beschaffung und Lieferung, wohin Sie auch möchten.',
      chinaCardTitle: 'Aus China',
      chinaCardText:
        'Neue und gebrauchte Fahrzeuge aus China — Lieferung über einen bewährten Partner.',
      exploreLabel: 'Mehr erfahren',
      ctaLabel: 'Importangebot berechnen',
    },
    de: {
      metaTitle: 'Fahrzeuge aus Deutschland — Import als Komplettpaket',
      metaDescription:
        'Wir suchen und liefern Fahrzeuge aus Deutschland — Prüfung, Unterlagen und Verzollung als Komplettpaket. Bereits geliefert nach Serbien, Spanien und Portugal.',
      title: 'Fahrzeuge aus Deutschland',
      titleHighlight: 'als Komplettpaket',
      description:
        'Wir suchen das Fahrzeug in Deutschland aus und liefern es Ihnen, wo immer Sie sind: Prüfung, Unterlagen und Verzollung als Komplettpaket.',
      ctaLabel: 'Anfrage senden',
      breadcrumbLabel: 'Fahrzeuge aus Deutschland',
      casesHeading: 'Beispiele: Fahrzeuge aus Deutschland',
      steps: [
        PRIVOZ_STEP_REQUEST_DE,
        vehicleImportStep02DE('Deutschland'),
        PRIVOZ_STEP_INSPECT_DE,
        PRIVOZ_STEP_EXPORT_DE,
        PRIVOZ_STEP_HANDOVER_DE,
      ],
      destinationsNote:
        'Wir liefern nach Serbien, Spanien und Portugal — und in jedes andere Land, sprechen Sie uns bei der Anfrage darauf an.',
      chinaCrossLabel: 'Interessieren Sie sich für ein Fahrzeug aus China?',
    },
    es: {
      metaTitle: 'Fahrzeuge aus Spanien — Import als Komplettpaket',
      metaDescription:
        'Wir suchen und liefern Fahrzeuge aus Spanien — Prüfung, Unterlagen und Verzollung als Komplettpaket. Bereits geliefert nach Serbien und Portugal.',
      title: 'Fahrzeuge aus Spanien',
      titleHighlight: 'als Komplettpaket',
      description:
        'Wir suchen das Fahrzeug in Spanien aus und liefern es Ihnen, wo immer Sie sind: Prüfung, Unterlagen und Verzollung als Komplettpaket.',
      ctaLabel: 'Anfrage senden',
      breadcrumbLabel: 'Fahrzeuge aus Spanien',
      casesHeading: 'Beispiele: Fahrzeuge aus Spanien',
      steps: [
        PRIVOZ_STEP_REQUEST_DE,
        vehicleImportStep02DE('Spanien'),
        PRIVOZ_STEP_INSPECT_DE,
        PRIVOZ_STEP_EXPORT_DE,
        PRIVOZ_STEP_HANDOVER_DE,
      ],
      destinationsNote:
        'Wir liefern nach Serbien und Portugal — und in jedes andere Land, sprechen Sie uns bei der Anfrage darauf an.',
      chinaCrossLabel: 'Interessieren Sie sich für ein Fahrzeug aus China?',
    },
    ch: {
      metaTitle: 'Fahrzeuge aus der Schweiz — Import als Komplettpaket',
      metaDescription:
        'Wir suchen und liefern Fahrzeuge aus der Schweiz — Prüfung, Unterlagen und Verzollung als Komplettpaket. Bereits geliefert nach Serbien, Spanien und Portugal.',
      title: 'Fahrzeuge aus der Schweiz',
      titleHighlight: 'als Komplettpaket',
      description:
        'Wir suchen das Fahrzeug in der Schweiz aus und liefern es Ihnen, wo immer Sie sind: Prüfung, Unterlagen und Verzollung als Komplettpaket.',
      ctaLabel: 'Anfrage senden',
      breadcrumbLabel: 'Fahrzeuge aus der Schweiz',
      casesHeading: 'Beispiele: Fahrzeuge aus der Schweiz',
      steps: [
        PRIVOZ_STEP_REQUEST_DE,
        vehicleImportStep02DE('der Schweiz'),
        PRIVOZ_STEP_INSPECT_DE,
        PRIVOZ_STEP_EXPORT_DE,
        PRIVOZ_STEP_HANDOVER_DE,
      ],
      destinationsNote:
        'Wir liefern nach Serbien, Spanien und Portugal — und in jedes andere Land, sprechen Sie uns bei der Anfrage darauf an.',
      chinaCrossLabel: 'Interessieren Sie sich für ein Fahrzeug aus China?',
    },
    eu: {
      metaTitle: 'Fahrzeuge aus Europa — Import als Komplettpaket',
      metaDescription:
        'Wir suchen und liefern Fahrzeuge aus jedem europäischen Land — Deutschland, Spanien, die Schweiz und weitere — Prüfung, Unterlagen und Verzollung als Komplettpaket.',
      title: 'Fahrzeuge aus Europa',
      titleHighlight: 'als Komplettpaket',
      description:
        'Wir suchen das Fahrzeug in Europa — Deutschland, Spanien, die Schweiz und andere europäische Länder — und liefern es Ihnen, wo immer Sie sind: Prüfung, Unterlagen und Verzollung als Komplettpaket.',
      ctaLabel: 'Anfrage senden',
      breadcrumbLabel: 'Fahrzeuge aus Europa',
      casesHeading: 'Beispiele: Fahrzeuge aus Europa',
      steps: [
        PRIVOZ_STEP_REQUEST_DE,
        {
          n: '02',
          text: 'Wir suchen ein Fahrzeug aus Europa — Deutschland, Spanien, die Schweiz und weitere europäische Länder',
        },
        PRIVOZ_STEP_INSPECT_DE,
        PRIVOZ_STEP_EXPORT_DE,
        PRIVOZ_STEP_HANDOVER_DE,
      ],
      sourceCountriesLabel: 'Wir importieren aus:',
      sourceMoreLabel: 'und weiteren europäischen Ländern',
      destinationsNote:
        'Wir liefern nach Serbien, Spanien und Portugal — und in jedes andere Land, sprechen Sie uns bei der Anfrage darauf an.',
    },
    china: {
      metaTitle: 'Fahrzeuge aus China — Import als Komplettpaket',
      metaDescription:
        'Wir organisieren den Import von Fahrzeugen aus China in jedes Land über einen bewährten Logistikpartner — Beschaffung, Unterlagen und Verzollung als Komplettpaket.',
      title: 'Fahrzeuge aus China',
      titleHighlight: 'als Komplettpaket',
      description:
        'Wir suchen das Fahrzeug in China aus und liefern es Ihnen, wo immer Sie sind — direkt über einen bewährten Logistikpartner, als Komplettpaket, inklusive Verzollung.',
      ctaLabel: 'Anfrage senden',
      breadcrumbLabel: 'Fahrzeuge aus China',
      casesHeading: 'Beispiele: Fahrzeuge aus China',
      steps: [
        PRIVOZ_STEP_REQUEST_DE,
        {
          n: '02',
          text: 'Wir suchen ein Fahrzeug aus China nach Ihren Kriterien',
        },
        {
          n: '03',
          text: 'Wir prüfen das Fahrzeug und erledigen die Exportunterlagen',
        },
        {
          n: '04',
          text: 'Wir organisieren die Lieferung in Ihre Stadt über unseren Logistikpartner',
        },
        PRIVOZ_STEP_HANDOVER_DE,
      ],
      deCrossLabel: 'Suchen Sie ein Fahrzeug aus Deutschland?',
      destinationsNote:
        'Wir liefern nach Serbien und Deutschland — und in jedes andere Land, sprechen Sie uns bei der Anfrage darauf an.',
    },
  },
  'vehicle-inspection': {
    title: 'Fahrzeugprüfung',
    description:
      'Unabhängige Fahrzeugprüfung vor dem Kauf. Ein Experte kommt vor Ort, führt eine Diagnose durch und erstellt einen Bericht — ohne Kaufverpflichtung.',
    ctaLabel: 'Prüfung beauftragen',
    casesHeading: 'Beispiele der Prüfung',
    breadcrumbLabel: 'Fahrzeugprüfung',
    steps: [
      {
        n: '01',
        text: 'Karosserie und Lack — Prüfung auf frühere Reparaturen oder Unfallschäden',
      },
      { n: '02', text: 'Fahrwerk, Radaufhängung, Bremsen' },
      { n: '03', text: 'Motor, Getriebe, Kraftübertragung' },
      {
        n: '04',
        text: 'Elektronik und Servicehistorie anhand der Fahrgestellnummer',
      },
      {
        n: '05',
        text: 'Rechtliche Sauberkeit — Belastungen, Zulassungssperren, Unfallhistorie',
      },
    ],
    extraLine:
      'Wir arbeiten auch in anderen europäischen Ländern, einschließlich Portugal — fragen Sie bei der Anfrage nach.',
  },
  cityVehicleSourcing: {
    title: 'Fahrzeugsuche',
    descriptionFor: (cityLocation, countryName) =>
      `Wir finden Ihr Fahrzeug ${cityLocation} mit vollständiger Prüfung. Wir arbeiten in ganz ${countryName}.`,
    casesHeadingFor: (countryGenitiveOrName) =>
      `Beispiele aus ${countryGenitiveOrName}`,
    whyCityHeadingFor: (cityName) => `Warum ${cityName}`,
    reason1: 'Ein bedeutender Fahrzeugmarkt der Region',
    reason2: 'Viele Angebote mit guter Historie',
    reason3For: (cityLocation) => `Unser Experte ist ${cityLocation}`,
    reason4Dekra: 'DEKRA- / TÜV-Prüfung auf Anfrage',
    reason4Generic: 'Unabhängige technische Prüfung auf Anfrage',
    otherCitiesLabelFor: (countryLocation) =>
      `Weitere Städte ${countryLocation}:`,
  },
  autoServiceBelgrade: {
    metaTitle: 'Autowerkstatt in Belgrad — Reparatur und Wartung',
    metaDescription:
      'Professionelle Reparatur und Wartung von Fahrzeugen in Belgrad mit Qualitätsgarantie. Diagnose, Wartung, Reparatur von Fahrwerk, Motor und Getriebe.',
    title: 'Autowerkstatt',
    titleHighlight: 'in Belgrad',
    description:
      'Professionelle Reparatur und Wartung von Fahrzeugen in Belgrad mit Qualitätsgarantie.',
    ctaLabel: 'Termin vereinbaren',
    breadcrumbLabel: 'Autowerkstatt in Belgrad',
    whatWeDoHeading: 'Was wir tun',
    whatWeDo: [
      {
        key: 'diagnostics',
        label: 'Computerdiagnose',
        desc: 'Fehlersuche mit moderner Diagnosetechnik',
      },
      {
        key: 'maintenance',
        label: 'Wartung',
        desc: 'Wechsel von Öl, Filtern und Betriebsflüssigkeiten',
      },
      {
        key: 'suspension',
        label: 'Fahrwerk und Bremsen',
        desc: 'Diagnose und Reparatur von Fahrwerk, Bremsanlage und Lenkung',
      },
      {
        key: 'engine',
        label: 'Motor und Getriebe',
        desc: 'Reparatur von Motor, Getriebe und Nebenaggregaten',
      },
      {
        key: 'prepurchase',
        label: 'Kaufprüfung',
        desc: 'Umfassende Prüfung des Fahrzeugs vor dem Kauf oder einer längeren Fahrt',
      },
    ],
    commentLabel: 'Marke, Modell, was zu erledigen ist',
    commentPlaceholder: 'BMW 320i, 2018, Geräusch im Fahrwerk…',
    alsoSourcingLabel: 'Wir suchen auch Fahrzeuge in:',
    howToFindHeading: 'So finden Sie uns',
    addressLabel: 'Adresse der Werkstatt',
    streetAddress: 'Peka Pavlovića 39',
    cityCountryLine: 'Belgrad, Serbien',
    mapButtonLabel: 'In Google Maps öffnen',
    mapIframeTitle: 'Autowerkstatt auf der Karte — Peka Pavlovića 39, Belgrad',
    worksHeading: 'Beispiele unserer Arbeit',
  },
  detailingBelgrade: {
    metaTitle:
      'Detailing in Belgrad — Folierung für Autos, Motorräder, Fahrräder und Yachten',
    metaDescription:
      'Detailing in Belgrad: Folierung von Autos, Motorrädern, Fahrrädern und Yachten.',
    title: 'Detailing',
    titleHighlight: 'in Belgrad',
    description:
      'Professionelles Detailing in Belgrad: Folierung von Autos, Motorrädern, Fahrrädern und Yachten.',
    ctaLabel: 'Anfrage senden',
    breadcrumbLabel: 'Detailing in Belgrad',
    whatWeDoHeading: 'Unsere Leistungen',
    whatWeDo: [
      {
        key: 'wrap',
        label: 'Folierung',
        desc: 'Vollständige und teilweise Folierung der Karosserie von Autos, Motorrädern, Fahrrädern und Yachten mit Schutz- oder Designfolie',
      },
    ],
    commentLabel: 'Marke, Modell, was zu erledigen ist',
    commentPlaceholder: 'BMW X5, 2019, Folierung…',
    alsoSourcingLabel: 'Wir suchen auch Fahrzeuge in:',
    howToFindHeading: 'So finden Sie uns',
    addressLabel: 'Adresse',
    streetAddress: 'Paštrovićeva 8',
    cityCountryLine: 'Belgrad, Serbien',
    mapButtonLabel: 'In Google Maps öffnen',
    mapIframeTitle: 'Detailing auf der Karte — Paštrovićeva 8, Belgrad',
    worksHeading: 'Beispiele unserer Arbeit',
  },
  caseChrome: {
    autoLabel: 'Fahrzeug',
    yearLabel: 'Baujahr',
    priceLabel: 'Preis',
    realCaseFallback: 'Ein echter Fall.',
    ctaEyebrow: 'Brauchen Sie den gleichen Service?',
    ctaHeading: 'Lassen Sie uns über Ihr Fahrzeug sprechen',
    ctaButtonLabel: 'Auf Telegram schreiben',
    whatsappButtonLabel: 'Auf WhatsApp schreiben',
    viberButtonLabel: 'Auf Viber schreiben',
    callbackButtonLabel: 'Rückruf anfordern',
    callbackShortLabel: 'Rückruf',
    callButtonLabel: 'Anrufen',
    channelBannerTitle: 'Weitere echte Fälle',
    channelBannerText:
      'Wir veröffentlichen neue Fälle, den Ablauf der Fahrzeugsuche und nützliche Tipps.',
    channelBannerCta: 'Abonnieren',
    usefulInfoLabel: 'Nützliche Informationen',
    serviceBadges: {
      'vehicle-sourcing': 'Fahrzeugsuche',
      'vehicle-buyback': 'Ankauf',
      'vehicle-inspection': 'Prüfung',
      'vehicle-import': 'Import',
      'auto-service-belgrade': 'Werkstatt',
      'detailing-belgrade': 'Detailing',
    },
  },
};

const content: Record<Locale, ServicesContent> = { ru, en, sr, es, de };

export function getServicesContent(locale: Locale): ServicesContent {
  return content[locale];
}
