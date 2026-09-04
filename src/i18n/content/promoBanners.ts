import type { Locale } from '@/i18n/config';
import type { CasesTabKind } from '@/utils/labels';

// SEO-keyword-dense banner shown on case-detail pages ("where we work") —
// one of these is picked at random per page render. City names are spelled
// out explicitly (not just "Serbia") because that's what people actually
// search for. Three separate sets: vehicle-sourcing cases talk about sourcing/
// buyback across all of Serbia, autoservice/detailing cases each talk about
// their own Belgrade-only shop.
const sourcingBanners: Record<Locale, string[]> = {
  ru: [
    'Если вам нужен **автоподбор в Белграде, Нови-Саде, Панчево, Суботице и по всей Сербии**, поможем найти действительно достойный автомобиль, проверив его историю, техническое состояние и юридическую чистоту.',
    'Если вам нужен **автоподбор в Сербии**, **автоподбор в Белграде**, **Нови-Саде**, **Нише**, **Суботице**, **Панчево**, **Крагуеваце**, **Чачаке**, **Ужице**, **Валево**, **Зренянине**, **Шабаце**, **Сомборе** или любом другом городе Сербии — мы проверим историю автомобиля, проведем профессиональную диагностику и поможем купить действительно достойный экземпляр.',
    'Если вам нужен **выкуп автомобиля в Сербии**, **срочный выкуп авто в Белграде**, **Нови-Саде**, **Нише**, **Суботице**, **Панчево**, **Крагуеваце**, **Чачаке**, **Ужице**, **Валево**, **Зренянине** или любом другом городе Сербии — мы быстро оценим автомобиль, предложим справедливую цену, оформим все документы и сразу произведем оплату.',
    'Если вам нужен **автоподбор в Сербии**, **Белграде**, **Нови-Саде**, **Нише**, **Суботице**, **Панчево**, **Крагуеваце**, **Чачаке**, **Ужице**, **Валево**, **Зренянине**, **Шабаце**, **Сомборе** или любом другом городе Сербии — мы проведем профессиональную проверку, изучим историю автомобиля и поможем безопасно купить действительно хороший вариант.',
    'Если вам нужен **автоподбор в Сербии**, **автоподбор в Белграде**, **Нови-Саде**, **Нише**, **Суботице**, **Панчево**, **Крагуеваце**, **Чачаке**, **Ужице**, **Валево**, **Зренянине**, **Сомборе**, **Шабаце** или любом другом городе Сербии — мы проверим автомобиль профессиональным оборудованием, оценим его техническое состояние и поможем купить действительно достойный вариант.',
    'Если вам нужен **пригон автомобиля из Германии в Сербию**, **BMW X6 из Германии**, подбор, проверка, доставка и растаможка «под ключ» — обращайтесь!',
    'Если вам нужен **автоподбор в Сербии**, **Белграде**, **Нови-Саде**, **Нише**, **Суботице**, **Панчево**, **Крагуеваце**, **Чачаке**, **Ужице**, **Валево**, **Зренянине** или любом другом городе Сербии, поможем найти действительно достойный автомобиль, проверим его историю, техническое состояние и избавим вас от риска неудачной покупки.',
    'Если вам нужен **автоподбор в Сербии**, **Белграде**, **Нови-Саде**, **Нише**, **Суботице**, **Панчево**, **Крагуеваце**, **Чачаке**, **Ужице**, **Валево**, **Зренянине** или любом другом городе Сербии, мы подберем автомобиль, тщательно проверим его историю, техническое состояние и поможем купить действительно достойный вариант.',
    'Если вам нужен **пригон автомобиля из Германии в Сербию**, помощь с подбором, профессиональная проверка перед покупкой, доставка, растаможка и подготовка автомобиля «под ключ» — обращайтесь. Мы заранее выявляем все недостатки, рассчитываем будущие расходы и помогаем купить действительно хороший автомобиль.',
    'Если вам нужен **автоподбор в Сербии**, **автоподбор в Белграде**, **Нови-Саде**, **Нише**, **Крагуеваце**, **Чачаке**, **Суботице**, **Панчево** или любом другом городе Сербии — поможем найти действительно хороший автомобиль, проверим его историю, техническое состояние и проведем сделку безопасно.',
  ],
  es: [
    '¿Buscas **búsqueda de autos en Belgrado, Novi Sad, Pančevo, Subotica o en cualquier parte de Serbia**? Te ayudamos a encontrar un auto realmente bueno, revisando su historial, estado técnico y situación legal.',
    'Si necesitas **búsqueda de autos en Serbia** — en **Belgrado**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Šabac**, **Sombor** o cualquier otra ciudad serbia — revisamos el historial del auto, hacemos un diagnóstico profesional y te ayudamos a comprar un ejemplar realmente sólido.',
    '¿Necesitas una **recompra de auto en Serbia** — una **recompra urgente en Belgrado**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin** o en cualquier otro lugar de Serbia? Evaluamos el auto rápido, te ofrecemos un precio justo, gestionamos todo el papeleo y pagamos de inmediato.',
    'Para **búsqueda de autos en Serbia** — **Belgrado**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Šabac**, **Sombor** o cualquier otra ciudad — hacemos una revisión profesional, estudiamos el historial del auto y te ayudamos a comprar con seguridad.',
    '¿Necesitas **búsqueda de autos en Serbia** — en **Belgrado**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Sombor**, **Šabac** o cualquier otra ciudad serbia? Inspeccionamos el auto con equipo profesional, evaluamos su estado técnico y te ayudamos a comprar uno realmente bueno.',
    '¿Necesitas **traer un auto desde Alemania a Serbia** — un **BMW X6 desde Alemania**, con búsqueda, inspección, transporte y despacho aduanero llave en mano? ¡Contáctanos!',
    'Para **búsqueda de autos en Serbia** — **Belgrado**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin** o cualquier otra ciudad serbia — te ayudamos a encontrar un auto realmente bueno, revisamos su historial y estado técnico, y te libramos del riesgo de una mala compra.',
    'Para **búsqueda de autos en Serbia** — **Belgrado**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin** o cualquier otra ciudad serbia — buscamos el auto, revisamos a fondo su historial y estado técnico, y te ayudamos a comprar uno realmente bueno.',
    '¿Necesitas **traer un auto desde Alemania a Serbia** — ayuda con la búsqueda, una inspección profesional antes de comprar, transporte, despacho aduanero y preparación llave en mano? Contáctanos. Detectamos cualquier defecto de antemano, calculamos los costos reales y te ayudamos a comprar un auto realmente bueno.',
    'Para **búsqueda de autos en Serbia** — **Belgrado**, **Novi Sad**, **Niš**, **Kragujevac**, **Čačak**, **Subotica**, **Pančevo** o cualquier otra ciudad serbia — te ayudamos a encontrar un auto realmente bueno, revisamos su historial y estado técnico, y cerramos la compra con seguridad.',
  ],
  de: [
    'Suchen Sie **Fahrzeugbeschaffung in Belgrad, Novi Sad, Pančevo, Subotica oder überall in Serbien**? Wir helfen Ihnen, ein wirklich lohnendes Auto zu finden, und prüfen dabei Historie, technischen Zustand und rechtliche Sauberkeit.',
    'Wenn Sie **Fahrzeugbeschaffung in Serbien** benötigen — in **Belgrad**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Šabac**, **Sombor** oder jeder anderen serbischen Stadt — prüfen wir die Fahrzeughistorie, führen eine professionelle Diagnose durch und helfen Ihnen, ein wirklich solides Exemplar zu kaufen.',
    'Brauchen Sie einen **Fahrzeug-Ankauf in Serbien** — einen **dringenden Ankauf in Belgrad**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin** oder anderswo in Serbien? Wir bewerten das Fahrzeug schnell, bieten einen fairen Preis, erledigen die gesamte Papierarbeit und zahlen sofort aus.',
    'Für **Fahrzeugbeschaffung in Serbien** — **Belgrad**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Šabac**, **Sombor** oder jede andere Stadt — führen wir eine professionelle Prüfung durch, untersuchen die Fahrzeughistorie und helfen Ihnen, sicher zu kaufen.',
    'Brauchen Sie **Fahrzeugbeschaffung in Serbien** — in **Belgrad**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Sombor**, **Šabac** oder jeder anderen serbischen Stadt? Wir prüfen das Fahrzeug mit professioneller Ausrüstung, beurteilen seinen technischen Zustand und helfen Ihnen, ein wirklich lohnendes Auto zu kaufen.',
    'Brauchen Sie einen **Fahrzeugimport aus Deutschland nach Serbien** — einen **BMW X6 aus Deutschland**, mit Beschaffung, Prüfung, Lieferung und Zollabfertigung, alles aus einer Hand? Melden Sie sich!',
    'Für **Fahrzeugbeschaffung in Serbien** — **Belgrad**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin** oder jede andere serbische Stadt — helfen wir Ihnen, ein wirklich lohnendes Auto zu finden, prüfen Historie und technischen Zustand und bewahren Sie vor einem Fehlkauf.',
    'Für **Fahrzeugbeschaffung in Serbien** — **Belgrad**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin** oder jede andere serbische Stadt — beschaffen wir das Fahrzeug, prüfen gründlich Historie und technischen Zustand und helfen Ihnen, ein wirklich lohnendes Auto zu kaufen.',
    'Brauchen Sie einen **Fahrzeugimport aus Deutschland nach Serbien** — Hilfe bei der Beschaffung, eine professionelle Kaufprüfung, Lieferung, Zollabfertigung und komplette Vorbereitung? Melden Sie sich. Wir decken jeden Mangel im Voraus auf, kalkulieren die tatsächlichen Kosten und helfen Ihnen, ein wirklich gutes Auto zu kaufen.',
    'Für **Fahrzeugbeschaffung in Serbien** — **Belgrad**, **Novi Sad**, **Niš**, **Kragujevac**, **Čačak**, **Subotica**, **Pančevo** oder jede andere serbische Stadt — helfen wir Ihnen, ein wirklich gutes Auto zu finden, prüfen Historie und technischen Zustand und wickeln den Kauf sicher ab.',
  ],
  en: [
    "Looking for **car sourcing in Belgrade, Novi Sad, Pančevo, Subotica, or anywhere in Serbia**? We'll help you find a genuinely worthy car, checking its history, technical condition, and legal standing.",
    "Whether you need **car sourcing in Serbia** — in **Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Šabac**, **Sombor**, or any other Serbian city — we'll check the car's history, run professional diagnostics, and help you buy a genuinely solid example.",
    "Need a **car buyback in Serbia** — an **urgent buyback in Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, or anywhere else in Serbia? We'll evaluate the car fast, offer a fair price, handle all the paperwork, and pay out right away.",
    "For **car sourcing in Serbia** — **Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Šabac**, **Sombor**, or any other city — we run a professional check, study the car's history, and help you buy safely.",
    'Need **car sourcing in Serbia** — in **Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Sombor**, **Šabac**, or any other Serbian city? We inspect the car with professional equipment, assess its technical condition, and help you buy a genuinely worthy one.',
    'Need a **car brought in from Germany to Serbia** — a **BMW X6 from Germany**, sourcing, inspection, delivery, and customs clearance, fully turnkey? Get in touch!',
    "For **car sourcing in Serbia** — **Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, or any other Serbian city — we'll help you find a genuinely worthy car, check its history and technical condition, and steer you clear of a bad purchase.",
    "For **car sourcing in Serbia** — **Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, or any other Serbian city — we'll source the car, thoroughly check its history and technical condition, and help you buy a genuinely worthy one.",
    'Need a **car brought in from Germany to Serbia** — help sourcing it, a professional pre-purchase inspection, delivery, customs clearance, and full turnkey prep? Get in touch. We catch every flaw upfront, work out the real costs ahead of time, and help you buy a genuinely good car.',
    "For **car sourcing in Serbia** — **Belgrade**, **Novi Sad**, **Niš**, **Kragujevac**, **Čačak**, **Subotica**, **Pančevo**, or any other Serbian city — we'll help you find a genuinely good car, check its history and technical condition, and close the deal safely.",
  ],
  sr: [
    'Da li vam je potreban **odabir vozila u Beogradu, Novom Sadu, Pančevu, Subotici ili bilo gde u Srbiji**? Pomoći ćemo vam da pronađete zaista vredan automobil, proverivši njegovu istoriju, tehničko stanje i pravnu ispravnost.',
    'Ako vam je potreban **odabir vozila u Srbiji** — u **Beogradu**, **Novom Sadu**, **Nišu**, **Subotici**, **Pančevu**, **Kragujevcu**, **Čačku**, **Užicu**, **Valjevu**, **Zrenjaninu**, **Šapcu**, **Somboru** ili bilo kom drugom gradu u Srbiji — proverićemo istoriju vozila, obaviti profesionalnu dijagnostiku i pomoći vam da kupite zaista vredan primerak.',
    'Treba vam **otkup vozila u Srbiji** — **hitan otkup u Beogradu**, **Novom Sadu**, **Nišu**, **Subotici**, **Pančevu**, **Kragujevcu**, **Čačku**, **Užicu**, **Valjevu**, **Zrenjaninu** ili bilo gde u Srbiji? Brzo ćemo proceniti vozilo, ponuditi poštenu cenu, srediti svu papirologiju i odmah isplatiti novac.',
    'Za **odabir vozila u Srbiji** — **Beogradu**, **Novom Sadu**, **Nišu**, **Subotici**, **Pančevu**, **Kragujevcu**, **Čačku**, **Užicu**, **Valjevu**, **Zrenjaninu**, **Šapcu**, **Somboru** ili bilo kom drugom gradu — obavljamo profesionalnu proveru, proučavamo istoriju vozila i pomažemo vam da bezbedno kupite zaista dobru opciju.',
    'Treba vam **odabir vozila u Srbiji** — u **Beogradu**, **Novom Sadu**, **Nišu**, **Subotici**, **Pančevu**, **Kragujevcu**, **Čačku**, **Užicu**, **Valjevu**, **Zrenjaninu**, **Somboru**, **Šapcu** ili bilo kom drugom gradu u Srbiji? Proveravamo vozilo profesionalnom opremom, procenjujemo njegovo tehničko stanje i pomažemo vam da kupite zaista vredan primerak.',
    'Treba vam **dovoženje vozila iz Nemačke u Srbiju** — **BMW X6 iz Nemačke**, odabir, provera, dostava i carinjenje „ključ u ruke"? Javite nam se!',
    'Za **odabir vozila u Srbiji** — **Beogradu**, **Novom Sadu**, **Nišu**, **Subotici**, **Pančevu**, **Kragujevcu**, **Čačku**, **Užicu**, **Valjevu**, **Zrenjaninu** ili bilo kom drugom gradu u Srbiji — pomoći ćemo vam da pronađete zaista vredan automobil, proveriti njegovu istoriju i tehničko stanje, i sačuvati vas od neuspešne kupovine.',
    'Za **odabir vozila u Srbiji** — **Beogradu**, **Novom Sadu**, **Nišu**, **Subotici**, **Pančevu**, **Kragujevcu**, **Čačku**, **Užicu**, **Valjevu**, **Zrenjaninu** ili bilo kom drugom gradu u Srbiji — pronaći ćemo vozilo, detaljno proveriti njegovu istoriju i tehničko stanje, i pomoći vam da kupite zaista vredan primerak.',
    'Treba vam **dovoženje vozila iz Nemačke u Srbiju** — pomoć oko odabira, profesionalna provera pre kupovine, dostava, carinjenje i priprema vozila „ključ u ruke"? Javite nam se. Unapred otkrivamo sve nedostatke, računamo buduće troškove i pomažemo vam da kupite zaista dobar automobil.',
    'Za **odabir vozila u Srbiji** — **Beogradu**, **Novom Sadu**, **Nišu**, **Kragujevcu**, **Čačku**, **Subotici**, **Pančevu** ili bilo kom drugom gradu u Srbiji — pomoći ćemo vam da pronađete zaista dobar automobil, proveriti njegovu istoriju i tehničko stanje, i bezbedno sprovesti kupovinu.',
  ],
};

const autoserviceBanners: Record<Locale, string[]> = {
  ru: [
    'Если вам нужна **компьютерная диагностика автомобиля в Белграде**, оперативно найдем причину неисправности и предложим оптимальное решение по ремонту.',
    'Если вам нужно **техническое обслуживание автомобиля в Белграде** — замена масла и фильтров, плановое ТО по регламенту производителя — обращайтесь в наш автосервис.',
    'Если вам нужен **ремонт подвески и тормозной системы в Белграде**, проверим состояние дисков, колодок, амортизаторов и рычагов и устраним причину вибраций или стуков.',
    'Если вам нужна **диагностика и ремонт двигателя или трансмиссии в Белграде**, найдем причину неисправности с помощью официального дилерского оборудования и выполним ремонт качественно.',
    'Если вам нужна **проверка автомобиля перед покупкой в Белграде**, проведем независимую техническую диагностику и покажем реальное состояние машины до сделки.',
    'Если вам нужен **автосервис в Белграде** — диагностика, ТО, ремонт подвески, тормозов, двигателя и трансмиссии — обращайтесь, работаем с любыми марками.',
  ],
  en: [
    "Need **computer diagnostics for your car in Belgrade**? We'll quickly find the cause of the issue and suggest the best repair solution.",
    'Need **scheduled maintenance in Belgrade** — oil and filter changes, manufacturer-schedule service? Get in touch with our auto service.',
    "Need **suspension and brake system repair in Belgrade**? We'll check the discs, pads, shocks and control arms and fix the cause of vibrations or noise.",
    "Need **engine or transmission diagnostics and repair in Belgrade**? We'll pinpoint the issue with official dealer-grade equipment and repair it properly.",
    "Need a **pre-purchase car inspection in Belgrade**? We'll run an independent technical check and show you the car's real condition before you buy.",
    'Need an **auto service in Belgrade** — diagnostics, maintenance, suspension, brake, engine and transmission repair? Get in touch, we work with any make.',
  ],
  sr: [
    'Treba vam **kompjuterska dijagnostika vozila u Beogradu**? Brzo ćemo pronaći uzrok kvara i predložiti najbolje rešenje za popravku.',
    'Treba vam **redovno održavanje vozila u Beogradu** — zamena ulja i filtera, servis po planu proizvođača? Javite se našem auto-servisu.',
    'Treba vam **popravka trapa i kočionog sistema u Beogradu**? Proverićemo diskove, pločice, amortizere i rukavice i otkloniti uzrok vibracija ili zvukova.',
    'Treba vam **dijagnostika i popravka motora ili menjača u Beogradu**? Uzrok kvara ćemo pronaći zvaničnom dilerskom opremom i kvalitetno ga otkloniti.',
    'Treba vam **provera vozila pre kupovine u Beogradu**? Obavićemo nezavisnu tehničku dijagnostiku i pokazati vam realno stanje vozila pre kupovine.',
    'Treba vam **auto-servis u Beogradu** — dijagnostika, redovno održavanje, popravka trapa, kočnica, motora i menjača? Javite se, radimo sa svim markama.',
  ],
  es: [
    '¿Necesitas un **diagnóstico computarizado de tu auto en Belgrado**? Encontramos rápido la causa del problema y te proponemos la mejor solución para repararlo.',
    '¿Necesitas **mantenimiento programado en Belgrado** — cambio de aceite y filtros, servicio según el plan del fabricante? Visita nuestro taller.',
    '¿Necesitas **reparación de suspensión y frenos en Belgrado**? Revisamos discos, pastillas, amortiguadores y brazos de suspensión, y eliminamos la causa de vibraciones o ruidos.',
    '¿Necesitas **diagnóstico y reparación de motor o transmisión en Belgrado**? Identificamos el problema con equipo de nivel concesionario oficial y lo reparamos correctamente.',
    '¿Necesitas una **inspección previa a la compra en Belgrado**? Hacemos una revisión técnica independiente y te mostramos el estado real del auto antes de comprarlo.',
    '¿Necesitas un **taller mecánico en Belgrado** — diagnóstico, mantenimiento, reparación de suspensión, frenos, motor y transmisión? Contáctanos, trabajamos con cualquier marca.',
  ],
  de: [
    'Brauchen Sie eine **Computerdiagnose für Ihr Auto in Belgrad**? Wir finden die Ursache des Problems schnell und schlagen die beste Reparaturlösung vor.',
    'Brauchen Sie eine **planmäßige Wartung in Belgrad** — Öl- und Filterwechsel, Service nach Herstellervorgaben? Wenden Sie sich an unsere Werkstatt.',
    'Brauchen Sie eine **Reparatur von Fahrwerk und Bremsanlage in Belgrad**? Wir prüfen Scheiben, Beläge, Stoßdämpfer und Querlenker und beheben die Ursache von Vibrationen oder Geräuschen.',
    'Brauchen Sie eine **Motor- oder Getriebediagnose und -reparatur in Belgrad**? Wir finden das Problem mit Vertragswerkstatt-Ausrüstung und reparieren es fachgerecht.',
    'Brauchen Sie eine **Gebrauchtwagenprüfung vor dem Kauf in Belgrad**? Wir führen eine unabhängige technische Prüfung durch und zeigen Ihnen den tatsächlichen Zustand des Fahrzeugs vor dem Kauf.',
    'Brauchen Sie eine **Autowerkstatt in Belgrad** — Diagnose, Wartung, Reparatur von Fahrwerk, Bremsen, Motor und Getriebe? Melden Sie sich, wir arbeiten mit jeder Marke.',
  ],
};

const detailingBanners: Record<Locale, string[]> = {
  ru: [
    'Если вам нужна **оклейка автомобиля плёнкой в Белграде**, поможем защитить кузов от сколов или изменить цвет — работаем с легковыми, мотоциклами, велосипедами и яхтами.',
    'Если вам нужен **детейлинг в Белграде** — оклейка защитной или декоративной плёнкой — обращайтесь, расскажем что подойдёт именно вашему транспорту.',
  ],
  en: [
    "Need **vinyl wrapping in Belgrade**? We'll help protect your paint from chips or change up the color — for cars, motorcycles, bicycles, and yachts.",
    "Looking for **detailing in Belgrade** — protective or decorative vinyl wrap? Get in touch, we'll advise on what suits your vehicle.",
  ],
  sr: [
    'Treba vam **folijacija vozila u Beogradu**? Pomoći ćemo da zaštitite lak od kamenčića ili promenite boju — radimo sa automobilima, motociklima, biciklima i jahtama.',
    'Tražite **detailing u Beogradu** — zaštitnu ili dekorativnu foliju? Javite se, savetovaćemo šta odgovara vašem vozilu.',
  ],
  es: [
    '¿Necesitas **envoltura vinílica de autos en Belgrado**? Te ayudamos a proteger la carrocería de rayones y golpes de piedra o a cambiar el color — trabajamos con autos, motos, bicicletas y yates.',
    '¿Buscas **detailing en Belgrado** — vinilo protector o decorativo? Contáctanos, te asesoramos sobre lo que mejor le queda a tu vehículo.',
  ],
  de: [
    'Brauchen Sie eine **Fahrzeugfolierung in Belgrad**? Wir helfen, den Lack vor Steinschlag zu schützen oder die Farbe zu ändern — für Autos, Motorräder, Fahrräder und Yachten.',
    'Suchen Sie **Detailing in Belgrad** — Schutz- oder Dekorfolie? Melden Sie sich, wir beraten Sie, was zu Ihrem Fahrzeug passt.',
  ],
};

export function getPromoBanners(
  locale: Locale,
  kind: CasesTabKind = 'vehicle-sourcing',
): string[] {
  if (kind === 'auto-service') return autoserviceBanners[locale];
  if (kind === 'detailing') return detailingBanners[locale];
  return sourcingBanners[locale];
}
