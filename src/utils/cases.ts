import type { CollectionEntry } from 'astro:content';
import { SERVICE_LABELS, AUTOSERVICE_LABELS } from './labels';
import type { CaseCardProps } from '../components/CaseCard.astro';

export const toCaseItem = (c: CollectionEntry<'cases'>, locale: string): CaseCardProps => ({
  href: `/${locale}/cases/${c.id}/`,
  image: c.data.image,
  imageAlt: c.data.car,
  badges: [SERVICE_LABELS[c.data.service] ?? c.data.service],
  car: c.data.car,
  year: c.data.year,
  price: c.data.price,
});

export const toAutoserviceCaseItem = (c: CollectionEntry<'autoserviceCases'>, locale: string): CaseCardProps => ({
  href: `/${locale}/avtoservis-belgrade/${c.id}/`,
  image: c.data.image,
  imageAlt: c.data.car,
  badges: c.data.servicesApplied.map(s => AUTOSERVICE_LABELS[s] ?? s),
  car: c.data.car,
  year: c.data.year,
  price: c.data.price,
});
