import type { Locale } from '@/i18n/config';

// SEO-keyword-dense banner shown on case-detail pages ("where we work") —
// one of these is picked at random per page render. City names are spelled
// out explicitly (not just "Serbia") because that's what people actually
// search for.
const banners: Record<Locale, string[]> = {
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
  en: [
    'Looking for **car sourcing in Belgrade, Novi Sad, Pančevo, Subotica, or anywhere in Serbia**? We\'ll help you find a genuinely worthy car, checking its history, technical condition, and legal standing.',
    'Whether you need **car sourcing in Serbia** — in **Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Šabac**, **Sombor**, or any other Serbian city — we\'ll check the car\'s history, run professional diagnostics, and help you buy a genuinely solid example.',
    'Need a **car buyout in Serbia** — an **urgent buyout in Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, or anywhere else in Serbia? We\'ll evaluate the car fast, offer a fair price, handle all the paperwork, and pay out right away.',
    'For **car sourcing in Serbia** — **Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Šabac**, **Sombor**, or any other city — we run a professional check, study the car\'s history, and help you buy safely.',
    'Need **car sourcing in Serbia** — in **Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, **Sombor**, **Šabac**, or any other Serbian city? We inspect the car with professional equipment, assess its technical condition, and help you buy a genuinely worthy one.',
    'Need a **car brought in from Germany to Serbia** — a **BMW X6 from Germany**, sourcing, inspection, delivery, and customs clearance, fully turnkey? Get in touch!',
    'For **car sourcing in Serbia** — **Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, or any other Serbian city — we\'ll help you find a genuinely worthy car, check its history and technical condition, and steer you clear of a bad purchase.',
    'For **car sourcing in Serbia** — **Belgrade**, **Novi Sad**, **Niš**, **Subotica**, **Pančevo**, **Kragujevac**, **Čačak**, **Užice**, **Valjevo**, **Zrenjanin**, or any other Serbian city — we\'ll source the car, thoroughly check its history and technical condition, and help you buy a genuinely worthy one.',
    'Need a **car brought in from Germany to Serbia** — help sourcing it, a professional pre-purchase inspection, delivery, customs clearance, and full turnkey prep? Get in touch. We catch every flaw upfront, work out the real costs ahead of time, and help you buy a genuinely good car.',
    'For **car sourcing in Serbia** — **Belgrade**, **Novi Sad**, **Niš**, **Kragujevac**, **Čačak**, **Subotica**, **Pančevo**, or any other Serbian city — we\'ll help you find a genuinely good car, check its history and technical condition, and close the deal safely.',
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

export function getGeoBanners(locale: Locale): string[] {
  return banners[locale];
}
