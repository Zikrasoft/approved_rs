export const prerender = true;

import type { APIRoute } from 'astro';
import { SITE_URL, SITE_NAME } from '../utils/constants';
import { SERVICES } from '../utils/labels';
import { getActiveCountries, getCitiesForCountry, getActiveRoutes, getCountry } from '../utils/geo';
import { getPublishedCases, getPublishedAutoserviceCases } from '../utils/casesQueries';

export const GET: APIRoute = async () => {
  const countries = getActiveCountries();
  const cases = await getPublishedCases();
  const autoserviceCases = await getPublishedAutoserviceCases();

  const lines: string[] = [];

  lines.push(`# ${SITE_NAME}`, '');
  lines.push(
    '> Автоподбор, выкуп, проверка и доставка автомобилей из Германии, Сербии и Испании ' +
    'для русскоязычных клиентов по всему миру. Полное сопровождение сделки, помощь с документами.',
    ''
  );

  // Includes 'dostavka' even though it's no longer in the nav-driving
  // SERVICES list — those pages are still live and indexable, just unlinked
  // from primary nav, and should stay discoverable here regardless.
  const LLMS_SERVICES = [...SERVICES, { slug: 'dostavka', label: 'Доставка' }];

  lines.push('## Услуги по странам', '');
  for (const country of countries) {
    for (const s of LLMS_SERVICES) {
      lines.push(`- [${s.label} в ${country.nameLocative}](${SITE_URL}/${country.code}/${s.slug}/)`);
    }
  }
  lines.push('');

  lines.push('## Автоподбор по городам', '');
  for (const country of countries) {
    for (const city of getCitiesForCountry(country.code)) {
      lines.push(`- [Автоподбор в ${city.nameLocative}](${SITE_URL}/${country.code}/${city.slug}/autopodbor/)`);
    }
  }
  lines.push('');

  const routes = getActiveRoutes();
  if (routes.length) {
    lines.push('## Доставка между странами', '');
    for (const r of routes) {
      const from = getCountry(r.from)!;
      const to = getCountry(r.to)!;
      lines.push(`- [Доставка из ${from.nameGenitive} в ${to.nameAccusative}](${SITE_URL}/dostavka/${r.from}-${r.to}/)`);
    }
    lines.push('');
  }

  lines.push('## Кейсы', '');
  lines.push(`- [Кейсы автоподбора](${SITE_URL}/cases/autopodbor/) — ${cases.length} реализованных подборов с автомобилем, страной и ценой`);
  lines.push(`- [Кейсы автосервиса](${SITE_URL}/cases/autoservice/) — ${autoserviceCases.length} примеров ремонта и обслуживания в Белграде`);
  lines.push('');

  lines.push('## Прочее', '');
  lines.push(`- [Главная](${SITE_URL}/)`);
  lines.push(`- [Контакты](${SITE_URL}/contacts/)`);

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
