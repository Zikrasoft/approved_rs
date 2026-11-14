import { withPlaceholder } from '@podbor/i18n';
import { SITE_NAME } from './constants';

type ListingPage = { number: number; count: number };

export const listingHeading = (
  number: number,
  { heading, pageName }: { heading: string; pageName: string },
) => (number > 1 ? withPlaceholder(pageName, 'page', String(number)) : heading);

export const listingTitle = (
  number: number,
  copy: { heading: string; pageName: string; metaTitle: string },
) =>
  number > 1
    ? `${listingHeading(number, copy)} | ${SITE_NAME}`
    : copy.metaTitle;

export const neighbours = (
  { number, count }: ListingPage,
  href: (number: number) => string,
) => ({
  prev: number > 1 ? href(number - 1) : null,
  next: number < count ? href(number + 1) : null,
});
