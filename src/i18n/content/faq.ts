import type { Locale } from '@/i18n/config';

export interface FaqItem {
  q: string;
  a: string;
}

interface FaqContent {
  autopodbor: FaqItem[];
  vykup: FaqItem[];
  proverka: FaqItem[];
  autoservice: FaqItem[];
  general: FaqItem[];
  cityExpert: FaqItem;
}

const ru: FaqContent = {
  autopodbor: [
    { q: 'Сколько занимает весь процесс — от заявки до машины у клиента?', a: 'В среднем 3–14 дней — зависит от того, как быстро находится подходящий вариант на рынке.' },
    { q: 'Если найденная машина не подошла, продолжаете искать бесплатно?', a: 'Да, продолжаем поиск без доплаты, пока не найдём то, что вам подходит.' },
    { q: 'Нужно ли самому ехать смотреть машину?', a: 'Нет, необязательно — можем провести всю сделку без вашего присутствия. Хотите приехать и посмотреть сами — тоже без проблем.' },
    { q: 'Какая гарантия на найденный автомобиль?', a: 'Формальной гарантии производителя, как на новый автомобиль, нет — это вторичный рынок. Ваша защита — независимая техническая проверка перед покупкой: машину осматривает эксперт, а не вы «вслепую».' },
    { q: 'Даёте ли фото- или видеоотчёт по машине до принятия решения?', a: 'Да, полный отчёт с фото по машине — до того, как вы принимаете решение о покупке.' },
    { q: 'Есть компенсация, если сроки сорваны по вашей вине?', a: 'Фиксированной неустойки нет — срок сделки часто зависит не только от нас (переговоры с продавцом, растаможка). Но называем реалистичный срок сразу и не тянем время.' },
  ],
  vykup: [
    { q: 'За сколько дней можно продать машину, если она ещё не растаможена или не переоформлена?', a: 'Обычно 1–2 дня, даже если машина ещё не растаможена или не переоформлена на вас.' },
    { q: 'Выкупаете машину в кредите или залоге?', a: 'Нет, выкупаем только автомобили без действующего кредита или залога.' },
    { q: 'Как быстро приходят деньги после осмотра?', a: 'В течение суток после осмотра.' },
    { q: 'Есть ограничения по марке, году или пробегу?', a: 'Да — не рассматриваем автомобили в плохом техническом состоянии и французские марки.' },
  ],
  proverka: [
    { q: 'Сколько стоит проверка и одинакова ли цена во всех странах?', a: 'Стоимость отличается по странам и зависит от объёма проверки — точную цифру назовём при заявке.' },
    { q: 'Можно заказать проверку, если вас физически нет в этой стране?', a: 'Да, ваше присутствие не обязательно — отчёт и решение получаете удалённо.' },
    { q: 'В каком виде отчёт?', a: 'Фото и подробное текстовое описание по итогам осмотра.' },
  ],
  autoservice: [
    { q: 'Работаете без предварительной записи?', a: 'На первую встречу можно просто позвонить и договориться о времени — предварительная запись не обязательна.' },
    { q: 'Даёте гарантию на ремонт?', a: 'Отдельной гарантии на выполненный ремонт нет — но диагностику проводим перед началом работ, и вы всегда знаете, за что платите.' },
  ],
  general: [
    { q: 'Как оплачивается работа?', a: 'Оплата наличными в день сделки — вы не переводите деньги вперёд.' },
    { q: 'Можно написать не в Telegram?', a: 'Да, помимо Telegram доступны звонки и WhatsApp.' },
  ],
  cityExpert: { q: 'В каждом городе есть свой выделенный эксперт?', a: 'В разных городах работают разные наши специалисты; в отдельных случаях эксперт выезжает в соседний город региона.' },
};

const en: FaqContent = {
  autopodbor: [
    { q: 'How long does the whole process take — from request to having the car?', a: 'Usually 3–14 days, depending on how quickly we find the right match on the market.' },
    { q: "If the car we find isn't right, do you keep looking for free?", a: 'Yes — we keep searching at no extra cost until we find the right one for you.' },
    { q: 'Do I need to come see the car myself?', a: "No, not at all — we can handle the whole deal without you being there. If you'd rather come see it yourself, that works too." },
    { q: 'What warranty comes with the car?', a: "There's no manufacturer warranty like on a new car — this is the used market. Your protection is the independent inspection before purchase: an expert examines the car, so you're never buying blind." },
    { q: 'Do you send a photo or video report before I decide?', a: 'Yes — a full photo report on the car, before you make any purchase decision.' },
    { q: 'Is there compensation if deadlines slip on your end?', a: "There's no fixed penalty — the timeline often depends on more than just us (negotiating with the seller, customs clearance). But we give you a realistic estimate upfront and don't waste time." },
  ],
  vykup: [
    { q: "How fast can I sell the car if it's not customs-cleared or re-registered yet?", a: "Usually 1–2 days, even if the car isn't customs-cleared or registered to you yet." },
    { q: 'Do you buy cars that are financed or pledged as collateral?', a: 'No — we only buy cars free of an active loan or lien.' },
    { q: 'How quickly does the money arrive after inspection?', a: 'Within 24 hours of the inspection.' },
    { q: 'Are there restrictions on make, year, or mileage?', a: "Yes — we don't take cars in poor technical condition, or French makes." },
  ],
  proverka: [
    { q: 'How much does an inspection cost, and is the price the same everywhere?', a: "The price varies by country and depends on the scope of the inspection — we'll give you an exact figure when you submit a request." },
    { q: "Can I order an inspection if I'm not physically in the country?", a: "Yes, you don't need to be there — you get the report and make the decision remotely." },
    { q: 'What form does the report take?', a: 'Photos plus a detailed written summary of the inspection.' },
  ],
  autoservice: [
    { q: 'Can I come without an appointment?', a: "For your first visit, just call and agree on a time — booking ahead isn't required." },
    { q: 'Do you guarantee the repair work?', a: "There's no separate warranty on completed repairs — but we run diagnostics before starting any work, so you always know what you're paying for." },
  ],
  general: [
    { q: 'How do I pay for the service?', a: 'Cash on the day of the deal — you never send money upfront.' },
    { q: 'Can I reach you somewhere other than Telegram?', a: 'Yes — besides Telegram, phone calls and WhatsApp both work.' },
  ],
  cityExpert: { q: 'Is there a dedicated expert in every city?', a: 'Different specialists cover different cities; in some cases an expert travels to a nearby city in the region.' },
};

const sr: FaqContent = {
  autopodbor: [
    { q: 'Koliko traje ceo proces — od zahteva do vozila kod klijenta?', a: 'U proseku 3–14 dana — zavisi koliko brzo se pronađe odgovarajuća ponuda na tržištu.' },
    { q: 'Ako pronađeno vozilo ne odgovara, da li nastavljate potragu besplatno?', a: 'Da, nastavljamo potragu bez doplate dok ne pronađemo ono što vam odgovara.' },
    { q: 'Da li je potrebno lično doći da vidite vozilo?', a: 'Ne, nije obavezno — celu kupovinu možemo obaviti bez vašeg prisustva. Ako želite sami da dođete i pogledate, nema problema.' },
    { q: 'Kakva garancija važi za pronađeno vozilo?', a: 'Zvanične garancije proizvođača, kao kod novog vozila, nema — reč je o tržištu polovnih automobila. Vaša zaštita je nezavisna tehnička provera pre kupovine: vozilo pregleda stručnjak, ne kupujete „naslepo“.' },
    { q: 'Da li dobijam foto ili video izveštaj o vozilu pre odluke?', a: 'Da, dobijate potpun izveštaj sa fotografijama pre nego što donesete odluku o kupovini.' },
    { q: 'Postoji li nadoknada ako rokovi kasne vašom krivicom?', a: 'Fiksne naknade nema — rok sklapanja posla često ne zavisi samo od nas (pregovori sa prodavcem, carinjenje). Ali odmah dajemo realan rok i ne odugovlačimo.' },
  ],
  vykup: [
    { q: 'Za koliko dana mogu da prodam vozilo ako još nije rastarinjeno ili prepisano?', a: 'Obično 1–2 dana, čak i ako vozilo još nije rastarinjeno ili prepisano na vas.' },
    { q: 'Da li otkupljujete vozilo pod kreditom ili u zalozi?', a: 'Ne, otkupljujemo samo vozila bez aktivnog kredita ili zaloge.' },
    { q: 'Koliko brzo stiže novac nakon pregleda?', a: 'U roku od 24 sata nakon pregleda.' },
    { q: 'Postoje li ograničenja po marki, godištu ili kilometraži?', a: 'Da — ne razmatramo vozila u lošem tehničkom stanju i francuske marke.' },
  ],
  proverka: [
    { q: 'Koliko košta provera i da li je cena ista u svim zemljama?', a: 'Cena se razlikuje po zemljama i zavisi od obima provere — tačan iznos dajemo uz zahtev.' },
    { q: 'Da li mogu da naručim proveru ako fizički nisam u toj zemlji?', a: 'Da, vaše prisustvo nije neophodno — izveštaj i odluku dobijate na daljinu.' },
    { q: 'U kom obliku dobijam izveštaj?', a: 'Fotografije i detaljan tekstualni opis nakon pregleda.' },
  ],
  autoservice: [
    { q: 'Da li radite bez prethodnog zakazivanja?', a: 'Za prvi dolazak dovoljno je da pozovete i dogovorite termin — zakazivanje unapred nije obavezno.' },
    { q: 'Da li dajete garanciju na izvršenu popravku?', a: 'Posebne garancije na obavljenu popravku nema — ali dijagnostiku radimo pre početka radova, tako da uvek znate za šta plaćate.' },
  ],
  general: [
    { q: 'Kako se plaća usluga?', a: 'Plaćanje u gotovini na dan realizacije posla — novac ne šaljete unapred.' },
    { q: 'Mogu li da vas kontaktiram i van Telegrama?', a: 'Da, pored Telegrama dostupni su i pozivi i WhatsApp.' },
  ],
  cityExpert: { q: 'Da li u svakom gradu postoji poseban stručnjak?', a: 'U različitim gradovima rade različiti naši stručnjaci; u pojedinim slučajevima stručnjak dolazi i u susedni grad u regionu.' },
};

const content: Record<Locale, FaqContent> = { ru, en, sr };

export function getFaq(locale: Locale): FaqContent {
  return content[locale];
}
