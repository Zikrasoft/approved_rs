import type { Locale } from '@/i18n/config';

interface PagesContent {
  contacts: {
    metaTitle: string;
    metaDescription: string;
    heroTitle: string;
    heroSubtitle: string;
    info: { label: string; value: string }[];
    workEyebrow: string;
    steps: { n: string; text: string }[];
  };
  privacy: {
    metaTitle: string;
    metaDescription: (siteName: string) => string;
    heading: string;
    lastUpdated: string;
    sections: { title: string; text: string }[];
    contactTitle: string;
    contactBefore: string;
    contactLinkText: string;
  };
  thanks: {
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    heading: string;
    body: string;
    ctaLabel: string;
    waitLabel: string;
    waitCasesLink: string;
    waitSourcingLink: string;
  };
  casesVehicleSourcing: { metaTitle: string; metaDescription: string };
  casesVehicleBuyback: { metaTitle: string; metaDescription: string };
  casesVehicleInspection: { metaTitle: string; metaDescription: string };
  casesVehicleImport: { metaTitle: string; metaDescription: string };
  casesAutoService: { metaTitle: string; metaDescription: string };
  casesDetailing: { metaTitle: string; metaDescription: string };
  casesShared: { heroSubtitle: string; emptyState: string };
}

const ru: PagesContent = {
  contacts: {
    metaTitle: 'Контакты',
    metaDescription: 'Свяжитесь с нами в Telegram. Автоподбор, доставка, выкуп авто из Европы.',
    heroTitle: 'Контакты',
    heroSubtitle: 'Работаем через Telegram — быстро и удобно',
    info: [
      { label: 'Время ответа', value: 'В течение 2 часов' },
      { label: 'Режим работы', value: 'Круглосуточно, без выходных' },
      { label: 'Языки', value: 'Русский, English' },
      { label: 'Страны', value: 'Германия, Испания, Сербия, Швейцария и др.' },
    ],
    workEyebrow: 'Как мы работаем',
    steps: [
      { n: '01', text: 'Пишете в Telegram или оставляете заявку на сайте' },
      { n: '02', text: 'Обсуждаем ваш запрос, уточняем детали и критерии' },
      { n: '03', text: 'Начинаем работу — находим, проверяем, привозим' },
    ],
  },
  privacy: {
    metaTitle: 'Политика конфиденциальности',
    metaDescription: (siteName) => `Политика конфиденциальности и обработки персональных данных сайта ${siteName}.`,
    heading: 'Политика конфиденциальности',
    lastUpdated: 'Последнее обновление: июнь 2026',
    sections: [
      { title: 'Какие данные мы собираем', text: 'При отправке заявки мы собираем имя и контактные данные (Telegram/телефон), которые вы вводите в форму. Мы также фиксируем страницу, с которой отправлена заявка.' },
      { title: 'Как мы используем данные', text: 'Собранные данные используются исключительно для обратной связи по вашей заявке. Мы не передаём данные третьим лицам и не используем их для рекламы.' },
      { title: 'Хранение данных', text: 'Данные хранятся на защищённых серверах Neon (PostgreSQL). Вы можете запросить удаление ваших данных в любое время, написав нам в Telegram.' },
      { title: 'Cookies', text: 'Сайт использует технические cookies, необходимые для работы сайта, а также аналитические cookies Google Analytics — но только после вашего согласия. При первом визите вы можете принять или отклонить использование аналитических cookies в баннере внизу экрана; ваш выбор сохраняется в браузере.' },
    ],
    contactTitle: 'Контакт',
    contactBefore: 'По вопросам конфиденциальности обратитесь к нам через ',
    contactLinkText: 'Telegram',
  },
  thanks: {
    metaTitle: 'Заявка принята',
    metaDescription: 'Ваша заявка принята. Свяжемся с вами в ближайшее время.',
    eyebrow: 'Заявка отправлена',
    heading: 'Скоро свяжемся',
    body: 'Мы получили вашу заявку и свяжемся в течение 2 часов. Если срочно — пишите в Telegram напрямую.',
    ctaLabel: 'Написать напрямую',
    waitLabel: 'Пока ждёте',
    waitCasesLink: 'Наши кейсы →',
    waitSourcingLink: 'Автоподбор под ключ →',
  },
  casesVehicleSourcing: {
    metaTitle: 'Кейсы автоподбора — реальные автомобили клиентов',
    metaDescription: 'Реальные кейсы автоподбора, доставки, выкупа и проверки автомобилей из Германии, Испании, Сербии и Швейцарии. Машина, цена, история сделки.',
  },
  casesVehicleBuyback: {
    metaTitle: 'Кейсы выкупа авто — реальные сделки',
    metaDescription: 'Реальные кейсы выкупа автомобилей: машина, цена и история сделки.',
  },
  casesVehicleInspection: {
    metaTitle: 'Кейсы проверки авто — реальные отчёты',
    metaDescription: 'Реальные кейсы проверки автомобилей перед покупкой: машина, цена и результат осмотра.',
  },
  casesVehicleImport: {
    metaTitle: 'Кейсы привоза авто — реальные автомобили клиентов',
    metaDescription: 'Реальные кейсы привоза автомобилей из Европы и Китая: машина, цена и история сделки.',
  },
  casesAutoService: {
    metaTitle: 'Кейсы автосервиса в Белграде — примеры работ',
    metaDescription: 'Реальные кейсы ремонта и обслуживания автомобилей в нашем автосервисе в Белграде: диагностика, ТО, ремонт подвески, двигателя и трансмиссии.',
  },
  casesDetailing: {
    metaTitle: 'Кейсы детейлинга в Белграде — примеры работ',
    metaDescription: 'Реальные кейсы детейлинга в Белграде: оклейка плёнкой автомобилей, мотоциклов, велосипедов и яхт.',
  },
  casesShared: {
    heroSubtitle: 'Реальные автомобили, реальные цены, реальные истории',
    emptyState: 'Кейсы скоро появятся.',
  },
};

const en: PagesContent = {
  contacts: {
    metaTitle: 'Contacts',
    metaDescription: 'Reach us on Telegram. Car sourcing, delivery, and buyback from Europe.',
    heroTitle: 'Contacts',
    heroSubtitle: 'We work through Telegram — fast and easy',
    info: [
      { label: 'Response time', value: 'Within 2 hours' },
      { label: 'Hours', value: '24/7, every day' },
      { label: 'Languages', value: 'Russian, English' },
      { label: 'Countries', value: 'Germany, Spain, Serbia, Switzerland, and more' },
    ],
    workEyebrow: 'How we work',
    steps: [
      { n: '01', text: 'Message us on Telegram or submit a request on the site' },
      { n: '02', text: 'We discuss your request and confirm the details and criteria' },
      { n: '03', text: 'We get to work — finding, inspecting, delivering' },
    ],
  },
  privacy: {
    metaTitle: 'Privacy Policy',
    metaDescription: (siteName) => `Privacy policy and personal data handling for ${siteName}.`,
    heading: 'Privacy Policy',
    lastUpdated: 'Last updated: June 2026',
    sections: [
      { title: 'What data we collect', text: 'When you submit a request, we collect the name and contact details (Telegram/phone) you enter in the form. We also record which page the request was sent from.' },
      { title: 'How we use your data', text: 'The data we collect is used solely to respond to your request. We do not share it with third parties or use it for advertising.' },
      { title: 'Data storage', text: 'Data is stored on secure Neon (PostgreSQL) servers. You can request deletion of your data at any time by messaging us on Telegram.' },
      { title: 'Cookies', text: 'The site uses technical cookies required for it to function, as well as Google Analytics cookies — but only with your consent. On your first visit you can accept or decline analytics cookies in the banner at the bottom of the screen; your choice is saved in your browser.' },
    ],
    contactTitle: 'Contact',
    contactBefore: 'For privacy questions, reach us on ',
    contactLinkText: 'Telegram',
  },
  thanks: {
    metaTitle: 'Request Received',
    metaDescription: "Your request has been received. We'll be in touch shortly.",
    eyebrow: 'Request sent',
    heading: "We'll be in touch soon",
    body: "We've received your request and will reach out within 2 hours. If it's urgent, message us directly on Telegram.",
    ctaLabel: 'Message us directly',
    waitLabel: 'While you wait',
    waitCasesLink: 'Our cases →',
    waitSourcingLink: 'Full-Service Car Sourcing →',
  },
  casesVehicleSourcing: {
    metaTitle: 'Car Sourcing Case Studies — Real Client Cars',
    metaDescription: 'Real case studies of car sourcing, delivery, buyback, and inspection from Germany, Spain, Serbia, and Switzerland. The car, the price, the story behind the deal.',
  },
  casesVehicleBuyback: {
    metaTitle: 'Car Buyback Case Studies — Real Deals',
    metaDescription: 'Real car buyback case studies: the car, the price, and the story behind the deal.',
  },
  casesVehicleInspection: {
    metaTitle: 'Car Inspection Case Studies — Real Reports',
    metaDescription: 'Real pre-purchase car inspection case studies: the car, the price, and the inspection result.',
  },
  casesVehicleImport: {
    metaTitle: 'Car Import Case Studies — Real Client Cars',
    metaDescription: 'Real case studies of cars imported from Europe and China: the car, the price, and the story behind the deal.',
  },
  casesAutoService: {
    metaTitle: 'Auto Service Case Studies in Belgrade — Our Work',
    metaDescription: 'Real examples of car repair and maintenance at our Belgrade service center: diagnostics, scheduled maintenance, suspension, engine, and transmission repair.',
  },
  casesDetailing: {
    metaTitle: 'Detailing Case Studies in Belgrade — Our Work',
    metaDescription: 'Real detailing case studies in Belgrade: vinyl wrapping for cars, motorcycles, bicycles, and yachts.',
  },
  casesShared: {
    heroSubtitle: 'Real cars, real prices, real stories',
    emptyState: 'Cases coming soon.',
  },
};

const sr: PagesContent = {
  contacts: {
    metaTitle: 'Kontakt',
    metaDescription: 'Kontaktirajte nas putem Telegrama. Odabir, dostava i otkup vozila iz Evrope.',
    heroTitle: 'Kontakt',
    heroSubtitle: 'Radimo preko Telegrama — brzo i jednostavno',
    info: [
      { label: 'Vreme odgovora', value: 'U roku od 2 sata' },
      { label: 'Radno vreme', value: '24/7, bez slobodnih dana' },
      { label: 'Jezici', value: 'Ruski, engleski' },
      { label: 'Zemlje', value: 'Nemačka, Španija, Srbija, Švajcarska i druge' },
    ],
    workEyebrow: 'Kako radimo',
    steps: [
      { n: '01', text: 'Pišete na Telegramu ili ostavljate zahtev na sajtu' },
      { n: '02', text: 'Razgovaramo o vašem zahtevu i preciziramo detalje i kriterijume' },
      { n: '03', text: 'Počinjemo rad — pronalazimo, proveravamo, dovozimo' },
    ],
  },
  privacy: {
    metaTitle: 'Politika privatnosti',
    metaDescription: (siteName) => `Politika privatnosti i obrade ličnih podataka sajta ${siteName}.`,
    heading: 'Politika privatnosti',
    lastUpdated: 'Poslednje ažuriranje: jun 2026.',
    sections: [
      { title: 'Koje podatke prikupljamo', text: 'Prilikom slanja zahteva prikupljamo ime i kontakt podatke (Telegram/telefon) koje unosite u formular. Takođe beležimo stranicu sa koje je zahtev poslat.' },
      { title: 'Kako koristimo podatke', text: 'Prikupljeni podaci koriste se isključivo za odgovor na vaš zahtev. Ne delimo podatke sa trećim licima niti ih koristimo za oglašavanje.' },
      { title: 'Čuvanje podataka', text: 'Podaci se čuvaju na zaštićenim Neon (PostgreSQL) serverima. U svakom trenutku možete zatražiti brisanje svojih podataka tako što ćete nam pisati na Telegramu.' },
      { title: 'Kolačići', text: 'Sajt koristi tehničke kolačiće neophodne za rad sajta, kao i analitičke Google Analytics kolačiće — ali samo uz vašu saglasnost. Prilikom prve posete možete prihvatiti ili odbiti korišćenje analitičkih kolačića u baneru na dnu ekrana; vaš izbor se čuva u pregledaču.' },
    ],
    contactTitle: 'Kontakt',
    contactBefore: 'Za pitanja o privatnosti obratite nam se putem ',
    contactLinkText: 'Telegrama',
  },
  thanks: {
    metaTitle: 'Zahtev primljen',
    metaDescription: 'Vaš zahtev je primljen. Javićemo vam se uskoro.',
    eyebrow: 'Zahtev poslat',
    heading: 'Uskoro se javljamo',
    body: 'Primili smo vaš zahtev i javićemo vam se u roku od 2 sata. Ako je hitno — pišite nam direktno na Telegramu.',
    ctaLabel: 'Pišite nam direktno',
    waitLabel: 'Dok čekate',
    waitCasesLink: 'Naši primeri →',
    waitSourcingLink: 'Kompletan odabir vozila →',
  },
  casesVehicleSourcing: {
    metaTitle: 'Primeri odabira vozila — stvarni automobili klijenata',
    metaDescription: 'Stvarni primeri odabira, dostave, otkupa i provere vozila iz Nemačke, Španije, Srbije i Švajcarske. Vozilo, cena, tok posla.',
  },
  casesVehicleBuyback: {
    metaTitle: 'Primeri otkupa vozila — stvarne transakcije',
    metaDescription: 'Stvarni primeri otkupa vozila: vozilo, cena i tok posla.',
  },
  casesVehicleInspection: {
    metaTitle: 'Primeri provere vozila — stvarni izveštaji',
    metaDescription: 'Stvarni primeri provere vozila pre kupovine: vozilo, cena i rezultat pregleda.',
  },
  casesVehicleImport: {
    metaTitle: 'Primeri uvoza vozila — stvarni automobili klijenata',
    metaDescription: 'Stvarni primeri uvoza vozila iz Evrope i Kine: vozilo, cena i tok posla.',
  },
  casesAutoService: {
    metaTitle: 'Primeri radova auto servisa u Beogradu',
    metaDescription: 'Stvarni primeri popravke i održavanja vozila u našem auto servisu u Beogradu: dijagnostika, redovno servisiranje, popravka vešanja, motora i menjača.',
  },
  casesDetailing: {
    metaTitle: 'Primeri radova detailinga u Beogradu',
    metaDescription: 'Stvarni primeri detailinga u Beogradu: folijacija automobila, motocikala, bicikala i jahti.',
  },
  casesShared: {
    heroSubtitle: 'Stvarna vozila, stvarne cene, stvarne priče',
    emptyState: 'Primeri uskoro stižu.',
  },
};

const es: PagesContent = {
  contacts: {
    metaTitle: 'Contacto',
    metaDescription: 'Contáctanos por Telegram. Búsqueda, importación y compra de coches en Europa.',
    heroTitle: 'Contacto',
    heroSubtitle: 'Trabajamos por Telegram — rápido y sencillo',
    info: [
      { label: 'Tiempo de respuesta', value: 'En un plazo de 2 horas' },
      { label: 'Horario', value: '24/7, todos los días' },
      { label: 'Idiomas', value: 'Ruso, inglés' },
      { label: 'Países', value: 'Alemania, España, Serbia, Suiza y otros' },
    ],
    workEyebrow: 'Cómo trabajamos',
    steps: [
      { n: '01', text: 'Escríbenos por Telegram o deja una solicitud en el sitio' },
      { n: '02', text: 'Hablamos sobre tu solicitud y precisamos los detalles y criterios' },
      { n: '03', text: 'Nos ponemos manos a la obra: buscamos, revisamos y entregamos' },
    ],
  },
  privacy: {
    metaTitle: 'Política de privacidad',
    metaDescription: (siteName) => `Política de privacidad y tratamiento de datos personales del sitio ${siteName}.`,
    heading: 'Política de privacidad',
    lastUpdated: 'Última actualización: junio de 2026',
    sections: [
      { title: 'Qué datos recopilamos', text: 'Al enviar una solicitud, recopilamos el nombre y los datos de contacto (Telegram/teléfono) que introduces en el formulario. También registramos la página desde la que se envió la solicitud.' },
      { title: 'Cómo usamos los datos', text: 'Los datos recopilados se utilizan exclusivamente para responder a tu solicitud. No compartimos los datos con terceros ni los utilizamos con fines publicitarios.' },
      { title: 'Almacenamiento de datos', text: 'Los datos se almacenan en servidores seguros de Neon (PostgreSQL). Puedes solicitar la eliminación de tus datos en cualquier momento escribiéndonos por Telegram.' },
      { title: 'Cookies', text: 'El sitio utiliza cookies técnicas necesarias para su funcionamiento, así como cookies analíticas de Google Analytics, pero solo con tu consentimiento. En tu primera visita puedes aceptar o rechazar el uso de cookies analíticas en el banner situado en la parte inferior de la pantalla; tu elección se guarda en el navegador.' },
    ],
    contactTitle: 'Contacto',
    contactBefore: 'Para consultas sobre privacidad, contáctanos por ',
    contactLinkText: 'Telegram',
  },
  thanks: {
    metaTitle: 'Solicitud recibida',
    metaDescription: 'Tu solicitud ha sido recibida. Nos pondremos en contacto contigo muy pronto.',
    eyebrow: 'Solicitud enviada',
    heading: 'Nos pondremos en contacto pronto',
    body: 'Hemos recibido tu solicitud y te contactaremos en un plazo de 2 horas. Si es urgente, escríbenos directamente por Telegram.',
    ctaLabel: 'Escribir directamente',
    waitLabel: 'Mientras esperas',
    waitCasesLink: 'Nuestros casos →',
    waitSourcingLink: 'Búsqueda de coches llave en mano →',
  },
  casesVehicleSourcing: {
    metaTitle: 'Casos de búsqueda de coches — vehículos reales de clientes',
    metaDescription: 'Casos reales de búsqueda, importación, compra y revisión de coches desde Alemania, España, Serbia y Suiza. El coche, el precio, la historia de la operación.',
  },
  casesVehicleBuyback: {
    metaTitle: 'Casos de compra de coches — operaciones reales',
    metaDescription: 'Casos reales de compra de coches: el vehículo, el precio y la historia de la operación.',
  },
  casesVehicleInspection: {
    metaTitle: 'Casos de revisión de coches — informes reales',
    metaDescription: 'Casos reales de revisión de coches antes de la compra: el vehículo, el precio y el resultado de la inspección.',
  },
  casesVehicleImport: {
    metaTitle: 'Casos de importación de coches — vehículos reales de clientes',
    metaDescription: 'Casos reales de importación de coches desde Europa y China: el vehículo, el precio y la historia de la operación.',
  },
  casesAutoService: {
    metaTitle: 'Casos del taller mecánico en Belgrado — ejemplos de trabajos',
    metaDescription: 'Casos reales de reparación y mantenimiento de coches en nuestro taller de Belgrado: diagnóstico, mantenimiento, reparación de suspensión, motor y transmisión.',
  },
  casesDetailing: {
    metaTitle: 'Casos de detailing en Belgrado — ejemplos de trabajos',
    metaDescription: 'Casos reales de detailing en Belgrado: envolturas de vinilo para coches, motocicletas, bicicletas y yates.',
  },
  casesShared: {
    heroSubtitle: 'Coches reales, precios reales, historias reales',
    emptyState: 'Los casos estarán disponibles pronto.',
  },
};

const de: PagesContent = {
  contacts: {
    metaTitle: 'Kontakt',
    metaDescription: 'Kontaktieren Sie uns über Telegram. Fahrzeugbeschaffung, Import und Ankauf von Autos aus Europa.',
    heroTitle: 'Kontakt',
    heroSubtitle: 'Wir arbeiten über Telegram — schnell und unkompliziert',
    info: [
      { label: 'Antwortzeit', value: 'Innerhalb von 2 Stunden' },
      { label: 'Öffnungszeiten', value: 'Rund um die Uhr, jeden Tag' },
      { label: 'Sprachen', value: 'Russisch, Englisch' },
      { label: 'Länder', value: 'Deutschland, Spanien, Serbien, Schweiz und weitere' },
    ],
    workEyebrow: 'So arbeiten wir',
    steps: [
      { n: '01', text: 'Schreiben Sie uns auf Telegram oder hinterlassen Sie eine Anfrage auf der Website' },
      { n: '02', text: 'Wir besprechen Ihre Anfrage und klären Details und Kriterien' },
      { n: '03', text: 'Wir beginnen mit der Arbeit — wir finden, prüfen und liefern' },
    ],
  },
  privacy: {
    metaTitle: 'Datenschutzerklärung',
    metaDescription: (siteName) => `Datenschutzerklärung und Informationen zur Verarbeitung personenbezogener Daten der Website ${siteName}.`,
    heading: 'Datenschutzerklärung',
    lastUpdated: 'Letzte Aktualisierung: Juni 2026',
    sections: [
      { title: 'Welche Daten wir erheben', text: 'Beim Absenden einer Anfrage erheben wir den Namen und die Kontaktdaten (Telegram/Telefon), die Sie in das Formular eingeben. Außerdem erfassen wir die Seite, von der aus die Anfrage gesendet wurde.' },
      { title: 'Wie wir die Daten verwenden', text: 'Die erhobenen Daten werden ausschließlich zur Beantwortung Ihrer Anfrage verwendet. Wir geben die Daten nicht an Dritte weiter und nutzen sie nicht für Werbezwecke.' },
      { title: 'Datenspeicherung', text: 'Die Daten werden auf gesicherten Neon-Servern (PostgreSQL) gespeichert. Sie können die Löschung Ihrer Daten jederzeit beantragen, indem Sie uns auf Telegram schreiben.' },
      { title: 'Cookies', text: 'Die Website verwendet technische Cookies, die für ihren Betrieb notwendig sind, sowie analytische Cookies von Google Analytics — jedoch nur mit Ihrer Einwilligung. Bei Ihrem ersten Besuch können Sie die Verwendung analytischer Cookies im Banner am unteren Bildschirmrand akzeptieren oder ablehnen; Ihre Wahl wird im Browser gespeichert.' },
    ],
    contactTitle: 'Kontakt',
    contactBefore: 'Bei Fragen zum Datenschutz erreichen Sie uns über ',
    contactLinkText: 'Telegram',
  },
  thanks: {
    metaTitle: 'Anfrage eingegangen',
    metaDescription: 'Ihre Anfrage ist eingegangen. Wir melden uns in Kürze bei Ihnen.',
    eyebrow: 'Anfrage gesendet',
    heading: 'Wir melden uns bald',
    body: 'Wir haben Ihre Anfrage erhalten und melden uns innerhalb von 2 Stunden. Bei dringenden Anliegen schreiben Sie uns direkt auf Telegram.',
    ctaLabel: 'Direkt schreiben',
    waitLabel: 'Während Sie warten',
    waitCasesLink: 'Unsere Fallstudien →',
    waitSourcingLink: 'Fahrzeugbeschaffung im Komplettpaket →',
  },
  casesVehicleSourcing: {
    metaTitle: 'Fallstudien zur Fahrzeugbeschaffung — echte Kundenfahrzeuge',
    metaDescription: 'Echte Fallstudien zur Fahrzeugbeschaffung, zum Import, Ankauf und zur Fahrzeugprüfung aus Deutschland, Spanien, Serbien und der Schweiz. Das Fahrzeug, der Preis, die Geschichte des Geschäfts.',
  },
  casesVehicleBuyback: {
    metaTitle: 'Fallstudien zum Autoankauf — echte Geschäfte',
    metaDescription: 'Echte Fallstudien zum Autoankauf: das Fahrzeug, der Preis und die Geschichte des Geschäfts.',
  },
  casesVehicleInspection: {
    metaTitle: 'Fallstudien zur Fahrzeugprüfung — echte Berichte',
    metaDescription: 'Echte Fallstudien zur Fahrzeugprüfung vor dem Kauf: das Fahrzeug, der Preis und das Ergebnis der Besichtigung.',
  },
  casesVehicleImport: {
    metaTitle: 'Fallstudien zum Fahrzeugimport — echte Kundenfahrzeuge',
    metaDescription: 'Echte Fallstudien zum Import von Fahrzeugen aus Europa und China: das Fahrzeug, der Preis und die Geschichte des Geschäfts.',
  },
  casesAutoService: {
    metaTitle: 'Fallstudien unserer Autowerkstatt in Belgrad — Arbeitsbeispiele',
    metaDescription: 'Echte Fallstudien zu Reparatur und Wartung von Fahrzeugen in unserer Werkstatt in Belgrad: Diagnose, Wartung, Reparatur von Fahrwerk, Motor und Getriebe.',
  },
  casesDetailing: {
    metaTitle: 'Fallstudien zum Detailing in Belgrad — Arbeitsbeispiele',
    metaDescription: 'Echte Fallstudien zum Detailing in Belgrad: Folierung von Autos, Motorrädern, Fahrrädern und Yachten.',
  },
  casesShared: {
    heroSubtitle: 'Echte Fahrzeuge, echte Preise, echte Geschichten',
    emptyState: 'Fallstudien folgen in Kürze.',
  },
};

const content: Record<Locale, PagesContent> = { ru, en, sr, es, de };

export function getPagesContent(locale: Locale): PagesContent {
  return content[locale];
}
