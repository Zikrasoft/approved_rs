import { articleSchema, serviceSchema } from '@podbor/site-kit';
import { SITE_URL } from '@/utils/constants';
import type { Work } from '@/utils/works';

export const BUSINESS_ID = `${SITE_URL}/#workshop`;

const BUSINESS = { '@id': BUSINESS_ID };
const BELGRADE = { '@type': 'City', name: 'Beograd' };

export const workSchema = (work: Work, headline: string) => (url: string) =>
  articleSchema({
    headline,
    image: new URL(work.data.image.src, SITE_URL).href,
    datePublished: work.data.date,
    publisher: BUSINESS,
    url,
  });

export const servicePageSchema =
  (service: { name: string; metaDescription: string }) => (url: string) =>
    serviceSchema({
      name: service.name,
      serviceType: service.name,
      description: service.metaDescription,
      provider: BUSINESS,
      areaServed: BELGRADE,
      url,
    });
