import type { Locale } from '@/i18n/config';

export interface FaqItem {
  q: string;
  a: string;
}

interface FaqContent {
  'vehicle-sourcing': FaqItem[];
  'vehicle-import': FaqItem[];
  'vehicle-buyback': FaqItem[];
  'vehicle-inspection': FaqItem[];
  autoServiceBelgrade: FaqItem[];
  detailingBelgrade: FaqItem[];
  general: FaqItem[];
  cityExpert: FaqItem;
}

const ru: FaqContent = {
  'vehicle-sourcing': [
    {
      q: 'Сколько занимает весь процесс — от заявки до машины у клиента?',
      a: 'В среднем 3–14 дней — зависит от того, как быстро находится подходящий вариант на рынке.',
    },
    {
      q: 'Если найденная машина не подошла, продолжаете искать бесплатно?',
      a: 'Да, продолжаем поиск без доплаты, пока не найдём то, что вам подходит.',
    },
    {
      q: 'Нужно ли самому ехать смотреть машину?',
      a: 'Нет, необязательно — можем провести всю сделку без вашего присутствия. Хотите приехать и посмотреть сами — тоже без проблем.',
    },
    {
      q: 'Какая гарантия на найденный автомобиль?',
      a: 'Формальной гарантии производителя, как на новый автомобиль, нет — это вторичный рынок. Ваша защита — независимая техническая проверка перед покупкой: машину осматривает эксперт, а не вы «вслепую».',
    },
    {
      q: 'Даёте ли фото- или видеоотчёт по машине до принятия решения?',
      a: 'Да, полный отчёт с фото по машине — до того, как вы принимаете решение о покупке.',
    },
    {
      q: 'Есть компенсация, если сроки сорваны по вашей вине?',
      a: 'Фиксированной неустойки нет — срок сделки часто зависит не только от нас (переговоры с продавцом, растаможка). Но называем реалистичный срок сразу и не тянем время.',
    },
  ],
  'vehicle-import': [
    {
      q: 'Чем привоз отличается от автоподбора?',
      a: 'Автоподбор — когда вы находитесь в той же стране, что и автомобиль. Привоз — когда машина едет к вам в Сербию из Европы или Китая.',
    },
    {
      q: 'Растаможка входит в стоимость?',
      a: 'Да, сопровождаем растаможку в Сербии и включаем её в расчёт — итоговую сумму называем до сделки.',
    },
  ],
  'vehicle-buyback': [
    {
      q: 'За сколько дней можно продать машину, если она ещё не растаможена или не переоформлена?',
      a: 'Обычно 1–2 дня, даже если машина ещё не растаможена или не переоформлена на вас.',
    },
    {
      q: 'Выкупаете машину в кредите или залоге?',
      a: 'Нет, выкупаем только автомобили без действующего кредита или залога.',
    },
    {
      q: 'Как быстро приходят деньги после осмотра?',
      a: 'В течение суток после осмотра.',
    },
    {
      q: 'Есть ограничения по марке, году или пробегу?',
      a: 'Да — не рассматриваем автомобили в плохом техническом состоянии и французские марки.',
    },
  ],
  'vehicle-inspection': [
    {
      q: 'Сколько стоит проверка и одинакова ли цена во всех странах?',
      a: 'Стоимость отличается по странам и зависит от объёма проверки — точную цифру назовём при заявке.',
    },
    {
      q: 'Можно заказать проверку, если вас физически нет в этой стране?',
      a: 'Да, ваше присутствие не обязательно — отчёт и решение получаете удалённо.',
    },
    {
      q: 'В каком виде отчёт?',
      a: 'Фото и подробное текстовое описание по итогам осмотра.',
    },
  ],
  autoServiceBelgrade: [
    {
      q: 'Работаете без предварительной записи?',
      a: 'На первую встречу можно просто позвонить и договориться о времени — предварительная запись не обязательна.',
    },
    {
      q: 'Даёте гарантию на ремонт?',
      a: 'Отдельной гарантии на выполненный ремонт нет — но диагностику проводим перед началом работ, и вы всегда знаете, за что платите.',
    },
  ],
  detailingBelgrade: [
    {
      q: 'Зачем оклеивать автомобиль плёнкой?',
      a: 'Оклейка защищает лакокрасочное покрытие от сколов, царапин и выцветания, а также позволяет изменить цвет автомобиля без покраски.',
    },
    {
      q: 'Портит ли плёнка заводскую краску?',
      a: 'Нет — при качественном материале и профессиональном монтаже и демонтаже заводское лакокрасочное покрытие под плёнкой не повреждается.',
    },
    {
      q: 'Можно ли снять плёнку и вернуть авто в исходный вид?',
      a: 'Да, плёнку можно снять в любой момент — под ней остаётся оригинальная краска.',
    },
    {
      q: 'Как ухаживать за автомобилем после оклейки?',
      a: 'Первое время после оклейки лучше мыть вручную или на бесконтактной мойке — избегайте жёстких щёток и агрессивной химии.',
    },
    {
      q: 'Нужно ли записываться заранее?',
      a: 'Да, лучше согласовать время заранее, чтобы подготовить материал под ваш автомобиль, мотоцикл, велосипед или яхту.',
    },
    {
      q: 'Работаете с любыми автомобилями и мотоциклами?',
      a: 'Да, оклеиваем любые марки и модели — автомобили, мотоциклы, велосипеды и яхты.',
    },
  ],
  general: [
    {
      q: 'Как оплачивается работа?',
      a: 'Оплата наличными в день сделки — вы не переводите деньги вперёд.',
    },
    {
      q: 'Можно написать не в Telegram?',
      a: 'Да, помимо Telegram доступны звонки и WhatsApp.',
    },
  ],
  cityExpert: {
    q: 'В каждом городе есть свой выделенный эксперт?',
    a: 'В разных городах работают разные наши специалисты; в отдельных случаях эксперт выезжает в соседний город региона.',
  },
};

const en: FaqContent = {
  'vehicle-sourcing': [
    {
      q: 'How long does the whole process take — from request to having the car?',
      a: 'Usually 3–14 days, depending on how quickly we find the right match on the market.',
    },
    {
      q: "If the car we find isn't right, do you keep looking for free?",
      a: 'Yes — we keep searching at no extra cost until we find the right one for you.',
    },
    {
      q: 'Do I need to come see the car myself?',
      a: "No, not at all — we can handle the whole deal without you being there. If you'd rather come see it yourself, that works too.",
    },
    {
      q: 'What warranty comes with the car?',
      a: "There's no manufacturer warranty like on a new car — this is the used market. Your protection is the independent inspection before purchase: an expert examines the car, so you're never buying blind.",
    },
    {
      q: 'Do you send a photo or video report before I decide?',
      a: 'Yes — a full photo report on the car, before you make any purchase decision.',
    },
    {
      q: 'Is there compensation if deadlines slip on your end?',
      a: "There's no fixed penalty — the timeline often depends on more than just us (negotiating with the seller, customs clearance). But we give you a realistic estimate upfront and don't waste time.",
    },
  ],
  'vehicle-import': [
    {
      q: 'How is import different from car sourcing?',
      a: "Sourcing is when you're in the same country as the car. Import is when the car travels to you in Serbia from Europe or China.",
    },
    {
      q: 'Is customs clearance included in the price?',
      a: 'Yes — we handle customs clearance in Serbia and include it in the quote, given to you before the deal.',
    },
  ],
  'vehicle-buyback': [
    {
      q: "How fast can I sell the car if it's not customs-cleared or re-registered yet?",
      a: "Usually 1–2 days, even if the car isn't customs-cleared or registered to you yet.",
    },
    {
      q: 'Do you buy cars that are financed or pledged as collateral?',
      a: 'No — we only buy cars free of an active loan or lien.',
    },
    {
      q: 'How quickly does the money arrive after inspection?',
      a: 'Within 24 hours of the inspection.',
    },
    {
      q: 'Are there restrictions on make, year, or mileage?',
      a: "Yes — we don't take cars in poor technical condition, or French makes.",
    },
  ],
  'vehicle-inspection': [
    {
      q: 'How much does an inspection cost, and is the price the same everywhere?',
      a: "The price varies by country and depends on the scope of the inspection — we'll give you an exact figure when you submit a request.",
    },
    {
      q: "Can I order an inspection if I'm not physically in the country?",
      a: "Yes, you don't need to be there — you get the report and make the decision remotely.",
    },
    {
      q: 'What form does the report take?',
      a: 'Photos plus a detailed written summary of the inspection.',
    },
  ],
  autoServiceBelgrade: [
    {
      q: 'Can I come without an appointment?',
      a: "For your first visit, just call and agree on a time — booking ahead isn't required.",
    },
    {
      q: 'Do you guarantee the repair work?',
      a: "There's no separate warranty on completed repairs — but we run diagnostics before starting any work, so you always know what you're paying for.",
    },
  ],
  detailingBelgrade: [
    {
      q: 'Why wrap a car with vinyl?',
      a: "Wrapping protects the paint from chips, scratches, and fading, and lets you change the car's color without repainting.",
    },
    {
      q: 'Does the film damage the factory paint?',
      a: "No — with quality material and professional installation and removal, the factory paint underneath isn't damaged.",
    },
    {
      q: 'Can the wrap be removed and the car returned to its original look?',
      a: 'Yes, the wrap can be removed at any time — the original paint is still there underneath.',
    },
    {
      q: 'How do I care for a wrapped car?',
      a: 'For the first while after wrapping, hand-wash it or use a touchless car wash — avoid stiff brushes and harsh chemicals.',
    },
    {
      q: 'Do I need to book in advance?',
      a: "Yes, it's best to agree on a time beforehand so we can prepare the material for your car, motorcycle, bicycle, or yacht.",
    },
    {
      q: 'Do you work with any car or motorcycle?',
      a: 'Yes — we wrap any make and model: cars, motorcycles, bicycles, and yachts.',
    },
  ],
  general: [
    {
      q: 'How do I pay for the service?',
      a: 'Cash on the day of the deal — you never send money upfront.',
    },
    {
      q: 'Can I reach you somewhere other than Telegram?',
      a: 'Yes — besides Telegram, phone calls and WhatsApp both work.',
    },
  ],
  cityExpert: {
    q: 'Is there a dedicated expert in every city?',
    a: 'Different specialists cover different cities; in some cases an expert travels to a nearby city in the region.',
  },
};

const sr: FaqContent = {
  'vehicle-sourcing': [
    {
      q: 'Koliko traje ceo proces — od zahteva do vozila kod klijenta?',
      a: 'U proseku 3–14 dana — zavisi koliko brzo se pronađe odgovarajuća ponuda na tržištu.',
    },
    {
      q: 'Ako pronađeno vozilo ne odgovara, da li nastavljate potragu besplatno?',
      a: 'Da, nastavljamo potragu bez doplate dok ne pronađemo ono što vam odgovara.',
    },
    {
      q: 'Da li je potrebno lično doći da vidite vozilo?',
      a: 'Ne, nije obavezno — celu kupovinu možemo obaviti bez vašeg prisustva. Ako želite sami da dođete i pogledate, nema problema.',
    },
    {
      q: 'Kakva garancija važi za pronađeno vozilo?',
      a: 'Zvanične garancije proizvođača, kao kod novog vozila, nema — reč je o tržištu polovnih automobila. Vaša zaštita je nezavisna tehnička provera pre kupovine: vozilo pregleda stručnjak, ne kupujete „naslepo“.',
    },
    {
      q: 'Da li dobijam foto ili video izveštaj o vozilu pre odluke?',
      a: 'Da, dobijate potpun izveštaj sa fotografijama pre nego što donesete odluku o kupovini.',
    },
    {
      q: 'Postoji li nadoknada ako rokovi kasne vašom krivicom?',
      a: 'Fiksne naknade nema — rok sklapanja posla često ne zavisi samo od nas (pregovori sa prodavcem, carinjenje). Ali odmah dajemo realan rok i ne odugovlačimo.',
    },
  ],
  'vehicle-import': [
    {
      q: 'Po čemu se uvoz razlikuje od odabira vozila?',
      a: 'Odabir vozila znači da ste u istoj zemlji kao i vozilo. Uvoz znači da vozilo putuje do vas u Srbiju iz Evrope ili Kine.',
    },
    {
      q: 'Da li je carinjenje uključeno u cenu?',
      a: 'Da, sređujemo carinjenje u Srbiji i uključujemo ga u ponudu — konačan iznos dajemo pre dogovora.',
    },
  ],
  'vehicle-buyback': [
    {
      q: 'Za koliko dana mogu da prodam vozilo ako još nije rastarinjeno ili prepisano?',
      a: 'Obično 1–2 dana, čak i ako vozilo još nije rastarinjeno ili prepisano na vas.',
    },
    {
      q: 'Da li otkupljujete vozilo pod kreditom ili u zalozi?',
      a: 'Ne, otkupljujemo samo vozila bez aktivnog kredita ili zaloge.',
    },
    {
      q: 'Koliko brzo stiže novac nakon pregleda?',
      a: 'U roku od 24 sata nakon pregleda.',
    },
    {
      q: 'Postoje li ograničenja po marki, godištu ili kilometraži?',
      a: 'Da — ne razmatramo vozila u lošem tehničkom stanju i francuske marke.',
    },
  ],
  'vehicle-inspection': [
    {
      q: 'Koliko košta provera i da li je cena ista u svim zemljama?',
      a: 'Cena se razlikuje po zemljama i zavisi od obima provere — tačan iznos dajemo uz zahtev.',
    },
    {
      q: 'Da li mogu da naručim proveru ako fizički nisam u toj zemlji?',
      a: 'Da, vaše prisustvo nije neophodno — izveštaj i odluku dobijate na daljinu.',
    },
    {
      q: 'U kom obliku dobijam izveštaj?',
      a: 'Fotografije i detaljan tekstualni opis nakon pregleda.',
    },
  ],
  autoServiceBelgrade: [
    {
      q: 'Da li radite bez prethodnog zakazivanja?',
      a: 'Za prvi dolazak dovoljno je da pozovete i dogovorite termin — zakazivanje unapred nije obavezno.',
    },
    {
      q: 'Da li dajete garanciju na izvršenu popravku?',
      a: 'Posebne garancije na obavljenu popravku nema — ali dijagnostiku radimo pre početka radova, tako da uvek znate za šta plaćate.',
    },
  ],
  detailingBelgrade: [
    {
      q: 'Zašto folirati automobil?',
      a: 'Folijacija štiti lak od kamenčića, ogrebotina i bleđenja, i omogućava promenu boje vozila bez ličenja.',
    },
    {
      q: 'Da li folija oštećuje fabrički lak?',
      a: 'Ne — uz kvalitetan materijal i profesionalnu ugradnju i skidanje, fabrički lak ispod folije ostaje neoštećen.',
    },
    {
      q: 'Da li se folija može skinuti i vratiti vozilo u originalni izgled?',
      a: 'Da, folija se može skinuti u bilo kom trenutku — originalni lak ostaje ispod nje.',
    },
    {
      q: 'Kako da negujem vozilo posle folijacije?',
      a: 'Prvo vreme posle folijacije perite ručno ili na beskontaktnoj auto-perionici — izbegavajte tvrde četke i agresivnu hemiju.',
    },
    {
      q: 'Da li je potrebno zakazivanje unapred?',
      a: 'Da, najbolje je unapred dogovoriti termin kako bismo pripremili materijal za vaš automobil, motocikl, bicikl ili jahtu.',
    },
    {
      q: 'Da li radite sa svim automobilima i motociklima?',
      a: 'Da, folijamo sve marke i modele — automobile, motocikle, bicikle i jahte.',
    },
  ],
  general: [
    {
      q: 'Kako se plaća usluga?',
      a: 'Plaćanje u gotovini na dan realizacije posla — novac ne šaljete unapred.',
    },
    {
      q: 'Mogu li da vas kontaktiram i van Telegrama?',
      a: 'Da, pored Telegrama dostupni su i pozivi i WhatsApp.',
    },
  ],
  cityExpert: {
    q: 'Da li u svakom gradu postoji poseban stručnjak?',
    a: 'U različitim gradovima rade različiti naši stručnjaci; u pojedinim slučajevima stručnjak dolazi i u susedni grad u regionu.',
  },
};

const es: FaqContent = {
  'vehicle-sourcing': [
    {
      q: '¿Cuánto dura todo el proceso, desde la solicitud hasta tener el coche?',
      a: 'Normalmente entre 3 y 14 días, según lo rápido que encontremos la opción adecuada en el mercado.',
    },
    {
      q: 'Si el coche que encuentran no me convence, ¿siguen buscando gratis?',
      a: 'Sí, seguimos buscando sin coste adicional hasta encontrar el que te convenga.',
    },
    {
      q: '¿Tengo que ir a ver el coche en persona?',
      a: 'No, no es necesario: podemos gestionar todo el proceso sin que estés presente. Si prefieres ir a verlo tú mismo, también es posible.',
    },
    {
      q: '¿Qué garantía tiene el coche encontrado?',
      a: 'No hay garantía de fábrica como en un coche nuevo: es mercado de segunda mano. Tu protección es la inspección técnica independiente antes de la compra: un experto revisa el coche, así que nunca compras a ciegas.',
    },
    {
      q: '¿Me envían un informe con fotos o vídeo antes de decidir?',
      a: 'Sí, recibes un informe completo con fotos del coche antes de tomar cualquier decisión de compra.',
    },
    {
      q: '¿Hay alguna compensación si los plazos se retrasan por su culpa?',
      a: 'No hay una penalización fija: el plazo de la operación a menudo no depende solo de nosotros (negociación con el vendedor, trámites aduaneros). Pero te damos un plazo realista desde el principio y no perdemos el tiempo.',
    },
  ],
  'vehicle-import': [
    {
      q: '¿En qué se diferencia la importación de la búsqueda de vehículos?',
      a: 'La búsqueda es cuando estás en el mismo país que el coche. La importación es cuando el coche viaja hasta ti en Serbia desde Europa o China.',
    },
    {
      q: '¿El despacho de aduana está incluido en el precio?',
      a: 'Sí, gestionamos el despacho de aduana en Serbia y lo incluimos en el presupuesto, que te damos antes de cerrar el trato.',
    },
  ],
  'vehicle-buyback': [
    {
      q: '¿En cuántos días puedo vender el coche si aún no está desaduanado o traspasado?',
      a: 'Normalmente en 1 o 2 días, aunque el coche todavía no esté desaduanado ni registrado a tu nombre.',
    },
    {
      q: '¿Compran coches con crédito o en prenda?',
      a: 'No, solo compramos coches sin crédito activo ni gravamen.',
    },
    {
      q: '¿Con qué rapidez llega el dinero tras la inspección?',
      a: 'En menos de 24 horas después de la inspección.',
    },
    {
      q: '¿Hay restricciones de marca, año o kilometraje?',
      a: 'Sí: no consideramos coches en mal estado técnico ni marcas francesas.',
    },
  ],
  'vehicle-inspection': [
    {
      q: '¿Cuánto cuesta la inspección y es el mismo precio en todos los países?',
      a: 'El precio varía según el país y depende del alcance de la inspección; te damos la cifra exacta al recibir tu solicitud.',
    },
    {
      q: '¿Puedo pedir una inspección si no estoy físicamente en ese país?',
      a: 'Sí, no hace falta que estés presente: recibes el informe y decides de forma remota.',
    },
    {
      q: '¿En qué formato viene el informe?',
      a: 'Fotos junto con una descripción detallada por escrito tras la inspección.',
    },
  ],
  autoServiceBelgrade: [
    {
      q: '¿Atienden sin cita previa?',
      a: 'Para la primera visita basta con llamar y acordar una hora; no es necesario reservar con antelación.',
    },
    {
      q: '¿Dan garantía sobre la reparación?',
      a: 'No hay una garantía aparte sobre la reparación realizada, pero hacemos un diagnóstico antes de empezar cualquier trabajo, así que siempre sabes por qué pagas.',
    },
  ],
  detailingBelgrade: [
    {
      q: '¿Para qué sirve forrar el coche con vinilo?',
      a: 'El forrado protege la pintura de golpes de piedra, arañazos y decoloración, y además permite cambiar el color del coche sin pintarlo.',
    },
    {
      q: '¿El vinilo daña la pintura original?',
      a: 'No: con un material de calidad y una instalación y retirada profesionales, la pintura de fábrica que queda debajo no sufre ningún daño.',
    },
    {
      q: '¿Se puede quitar el vinilo y dejar el coche como estaba?',
      a: 'Sí, el vinilo se puede retirar en cualquier momento; debajo queda la pintura original.',
    },
    {
      q: '¿Cómo cuido el coche después de forrarlo?',
      a: 'Durante el primer tiempo tras el forrado, es mejor lavarlo a mano o con un túnel sin contacto; evita cepillos duros y productos químicos agresivos.',
    },
    {
      q: '¿Hay que reservar con antelación?',
      a: 'Sí, es mejor acordar la hora con antelación para preparar el material adecuado para tu coche, moto, bicicleta o yate.',
    },
    {
      q: '¿Trabajan con cualquier coche o moto?',
      a: 'Sí, forramos cualquier marca y modelo: coches, motos, bicicletas y yates.',
    },
  ],
  general: [
    {
      q: '¿Cómo se paga el servicio?',
      a: 'En efectivo el día de la operación; nunca tienes que enviar dinero por adelantado.',
    },
    {
      q: '¿Puedo escribirles fuera de Telegram?',
      a: 'Sí, además de Telegram también puedes llamar o escribir por WhatsApp.',
    },
  ],
  cityExpert: {
    q: '¿Hay un experto dedicado en cada ciudad?',
    a: 'En cada ciudad trabajan especialistas distintos de nuestro equipo; en algunos casos un experto se desplaza a una ciudad cercana de la región.',
  },
};

const de: FaqContent = {
  'vehicle-sourcing': [
    {
      q: 'Wie lange dauert der gesamte Prozess – von der Anfrage bis zum eigenen Auto?',
      a: 'Meist 3 bis 14 Tage, je nachdem, wie schnell wir das passende Fahrzeug auf dem Markt finden.',
    },
    {
      q: 'Wenn das gefundene Auto nicht passt, suchen Sie dann kostenlos weiter?',
      a: 'Ja, wir suchen ohne Aufpreis weiter, bis wir das richtige Auto für Sie gefunden haben.',
    },
    {
      q: 'Muss ich das Auto persönlich besichtigen?',
      a: 'Nein, das ist nicht nötig – wir können den gesamten Kauf auch ohne Ihre Anwesenheit abwickeln. Wenn Sie es sich lieber selbst ansehen möchten, ist das ebenfalls kein Problem.',
    },
    {
      q: 'Welche Garantie gilt für das gefundene Fahrzeug?',
      a: 'Eine Herstellergarantie wie bei einem Neuwagen gibt es nicht – es handelt sich um den Gebrauchtwagenmarkt. Ihr Schutz ist die unabhängige technische Prüfung vor dem Kauf: Ein Experte begutachtet das Auto, sodass Sie nicht „blind" kaufen.',
    },
    {
      q: 'Erhalte ich vor der Entscheidung einen Foto- oder Videobericht?',
      a: 'Ja, Sie erhalten einen vollständigen Bericht mit Fotos zum Fahrzeug, bevor Sie sich zum Kauf entscheiden.',
    },
    {
      q: 'Gibt es eine Entschädigung, wenn sich der Termin durch Ihr Verschulden verzögert?',
      a: 'Eine feste Vertragsstrafe gibt es nicht – der Zeitrahmen hängt oft nicht nur von uns ab (Verhandlungen mit dem Verkäufer, Zollabfertigung). Wir nennen Ihnen aber von Anfang an einen realistischen Termin und ziehen die Sache nicht in die Länge.',
    },
  ],
  'vehicle-import': [
    {
      q: 'Worin unterscheidet sich der Import von der Fahrzeugbeschaffung?',
      a: 'Bei der Fahrzeugbeschaffung befinden Sie sich im selben Land wie das Auto. Beim Import kommt das Auto aus Europa oder China zu Ihnen nach Serbien.',
    },
    {
      q: 'Ist die Zollabfertigung im Preis enthalten?',
      a: 'Ja, wir übernehmen die Zollabfertigung in Serbien und rechnen sie mit ein – den Gesamtbetrag nennen wir Ihnen vor Vertragsabschluss.',
    },
  ],
  'vehicle-buyback': [
    {
      q: 'In wie vielen Tagen kann ich das Auto verkaufen, wenn es noch nicht verzollt oder umgemeldet ist?',
      a: 'In der Regel 1–2 Tage, auch wenn das Auto noch nicht verzollt oder auf Sie umgemeldet ist.',
    },
    {
      q: 'Kaufen Sie Fahrzeuge an, die noch finanziert oder verpfändet sind?',
      a: 'Nein, wir kaufen nur Fahrzeuge ohne laufenden Kredit oder Pfandrecht an.',
    },
    {
      q: 'Wie schnell kommt das Geld nach der Besichtigung an?',
      a: 'Innerhalb von 24 Stunden nach der Besichtigung.',
    },
    {
      q: 'Gibt es Einschränkungen bei Marke, Baujahr oder Laufleistung?',
      a: 'Ja – wir übernehmen keine Fahrzeuge in schlechtem technischem Zustand und keine französischen Marken.',
    },
  ],
  'vehicle-inspection': [
    {
      q: 'Was kostet die Prüfung, und ist der Preis in allen Ländern gleich?',
      a: 'Der Preis variiert je nach Land und Umfang der Prüfung – die genaue Summe nennen wir Ihnen bei Ihrer Anfrage.',
    },
    {
      q: 'Kann ich eine Prüfung beauftragen, wenn ich mich nicht selbst im Land befinde?',
      a: 'Ja, Ihre Anwesenheit ist nicht erforderlich – Sie erhalten den Bericht und treffen die Entscheidung aus der Ferne.',
    },
    {
      q: 'In welcher Form erhalte ich den Bericht?',
      a: 'Fotos sowie eine ausführliche schriftliche Beschreibung nach der Besichtigung.',
    },
  ],
  autoServiceBelgrade: [
    {
      q: 'Arbeiten Sie ohne vorherige Terminvereinbarung?',
      a: 'Für den ersten Besuch reicht ein Anruf, um eine Uhrzeit zu vereinbaren – eine Voranmeldung ist nicht erforderlich.',
    },
    {
      q: 'Geben Sie eine Garantie auf die Reparatur?',
      a: 'Eine gesonderte Garantie auf die ausgeführte Reparatur gibt es nicht – wir führen aber vor Arbeitsbeginn eine Diagnose durch, sodass Sie immer wissen, wofür Sie bezahlen.',
    },
  ],
  detailingBelgrade: [
    {
      q: 'Wofür wird ein Auto mit Folie beklebt?',
      a: 'Die Folierung schützt den Lack vor Steinschlag, Kratzern und Ausbleichen und ermöglicht außerdem einen Farbwechsel ohne Lackierung.',
    },
    {
      q: 'Beschädigt die Folie den Werkslack?',
      a: 'Nein – bei hochwertigem Material sowie professioneller Anbringung und Entfernung bleibt der Werkslack unter der Folie unbeschädigt.',
    },
    {
      q: 'Kann die Folie entfernt und das Auto in den Originalzustand zurückversetzt werden?',
      a: 'Ja, die Folie kann jederzeit entfernt werden – darunter bleibt der Originallack erhalten.',
    },
    {
      q: 'Wie pflege ich das Auto nach der Folierung?',
      a: 'In der ersten Zeit nach der Folierung sollten Sie das Auto besser von Hand oder in einer berührungslosen Waschanlage waschen – vermeiden Sie harte Bürsten und aggressive Chemikalien.',
    },
    {
      q: 'Muss ich vorab einen Termin vereinbaren?',
      a: 'Ja, am besten vereinbaren Sie den Termin im Voraus, damit wir das passende Material für Ihr Auto, Motorrad, Fahrrad oder Ihre Yacht vorbereiten können.',
    },
    {
      q: 'Arbeiten Sie mit allen Autos und Motorrädern?',
      a: 'Ja, wir folieren jede Marke und jedes Modell – Autos, Motorräder, Fahrräder und Yachten.',
    },
  ],
  general: [
    {
      q: 'Wie erfolgt die Bezahlung?',
      a: 'Bar am Tag des Geschäfts – Sie überweisen nie Geld im Voraus.',
    },
    {
      q: 'Kann ich Sie auch außerhalb von Telegram erreichen?',
      a: 'Ja, neben Telegram erreichen Sie uns auch per Anruf oder WhatsApp.',
    },
  ],
  cityExpert: {
    q: 'Gibt es in jeder Stadt einen eigenen Experten?',
    a: 'In den verschiedenen Städten sind unterschiedliche Spezialisten unseres Teams tätig; in einzelnen Fällen fährt ein Experte auch in eine benachbarte Stadt der Region.',
  },
};

const content: Record<Locale, FaqContent> = { ru, en, sr, es, de };

export function getFaq(locale: Locale): FaqContent {
  return content[locale];
}
