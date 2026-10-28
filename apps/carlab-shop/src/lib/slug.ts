export const slugOf = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const DATES = /\b\d{1,2}[./]\d{4}\b|\b(?:19|20)\d{2}\b/gu;

const isCode = (token: string) => /[a-z]/u.test(token) && /\d/u.test(token);

export function modelSlugOf(names: {
  make: string;
  series: string;
  chassis: string;
  model: string;
}): string {
  const make = slugOf(names.make);
  const withoutMake = (name: string) => {
    const slug = slugOf(name.replace(DATES, ' '));
    if (slug === make) return '';
    return slug.startsWith(`${make}-`) ? slug.slice(make.length + 1) : slug;
  };
  const seen = new Set<string>();
  return [names.series, names.chassis, names.model]
    .map(withoutMake)
    .join('-')
    .split('-')
    .filter((token) => {
      if (!token) return false;
      if (!isCode(token)) return true;
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    })
    .join('-');
}

export const vehicleSlugOf = ({
  engine,
  power_kw,
}: {
  engine: string;
  power_kw: number | null;
}) => slugOf(power_kw ? `${engine} ${power_kw}kw` : engine);
