import type { APIRoute } from 'astro';
import { SITE_URL, SITE_NAME } from '../utils/constants';
import { SERVICES } from '../utils/labels';
import { getI18n } from '../i18n/getI18n';
import { getActiveCountries, getCitiesForCountry } from '../utils/geo';
import { getPublishedCases, getPublishedAutoserviceCases } from '../utils/casesQueries';

export const GET: APIRoute = async () => {
  const countries = getActiveCountries();
  const cases = await getPublishedCases();
  const autoserviceCases = await getPublishedAutoserviceCases();
  const nav = getI18n('ru').nav;

  const lines: string[] = [];

  lines.push(`# ${SITE_NAME}`, '');
  lines.push(
    '> Автоподбор, выкуп, проверка и доставка автомобилей из Германии, Сербии, Испании и Швейцарии ' +
    'для русскоязычных клиентов по всему миру. Полное сопровождение сделки, помощь с документами.',
    ''
  );

  lines.push('## Услуги по странам', '');
  for (const country of countries) {
    for (const s of SERVICES) {
      lines.push(`- [${nav[s.slug]} в ${country.ru.nameLocative}](${SITE_URL}/ru/${country.code}/${s.slug}/)`);
    }
  }
  lines.push('');

  lines.push('## Автоподбор по городам', '');
  for (const country of countries) {
    for (const city of getCitiesForCountry(country.code)) {
      lines.push(`- [Автоподбор в ${city.ru.nameLocative}](${SITE_URL}/ru/${country.code}/${city.slug}/autopodbor/)`);
    }
  }
  lines.push('');

  lines.push('## Кейсы', '');
  lines.push(`- [Кейсы автоподбора](${SITE_URL}/ru/cases/autopodbor/) — ${cases.length} реализованных подборов с автомобилем, страной и ценой`);
  lines.push(`- [Кейсы автосервиса](${SITE_URL}/ru/cases/autoservice/) — ${autoserviceCases.length} примеров ремонта и обслуживания в Белграде`);
  lines.push('');

  lines.push('## Прочее', '');
  lines.push(`- [Главная](${SITE_URL}/ru/)`);
  lines.push(`- [Контакты](${SITE_URL}/ru/contacts/)`);

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
