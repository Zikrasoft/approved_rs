import wide from '@/assets/mechanic-engine-teardown-wide.jpg';
import type { Article } from '@/utils/blog';

type Over = Partial<Article['data']> & { id?: string; body?: string };

export const article = ({
  id = 'oil-change',
  body = 'Масло меняем раз в год.',
  ...data
}: Over = {}) =>
  ({
    id,
    body,
    collection: 'articles',
    data: {
      title: 'Когда менять масло',
      lead: 'Коротко о сроках замены масла.',
      date: new Date('2026-10-01'),
      image: wide,
      overview: false,
      faq: [],
      published: true,
      ...data,
    },
  }) as unknown as Article;
