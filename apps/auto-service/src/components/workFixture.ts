import wide from '@/assets/hero-mechanic-wide.jpg';
import type { Work } from '@/utils/works';

type Over = Partial<Work['data']> & { id?: string; body?: string };

export const work = ({ id = 'bmw-x3', body = '', ...data }: Over = {}) =>
  ({
    id,
    body,
    collection: 'works',
    data: {
      title: 'Замена масла',
      car: 'BMW X3',
      year: 2021,
      servicesApplied: ['servicing'],
      parts: [],
      image: wide,
      gallery: [],
      date: new Date('2026-09-15'),
      published: true,
      featured: false,
      ...data,
    },
  }) as unknown as Work;
