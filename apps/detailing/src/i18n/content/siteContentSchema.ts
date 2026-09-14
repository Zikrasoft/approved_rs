import { z } from 'zod';

const navSchema = z
  .object({
    services: z.string(),
    works: z.string(),
    process: z.string(),
    prices: z.string(),
    contact: z.string(),
  })
  .strict();

const headerSchema = z
  .object({
    primaryNavLabel: z.string(),
    mobileNavLabel: z.string(),
    menuOpenLabel: z.string(),
    menuCloseLabel: z.string(),
    languageLabel: z.string(),
    cta: z.string(),
  })
  .strict();

const footerSchema = z
  .object({
    tagline: z.string(),
    navHeading: z.string(),
    contactHeading: z.string(),
    hoursHeading: z.string(),
    hours: z.string(),
    privacyLabel: z.string(),
    rightsSuffix: z.string(),
  })
  .strict();

const commonSchema = z
  .object({
    homeLabel: z.string(),
    skipToContent: z.string(),
    breadcrumbLabel: z.string(),
    readMore: z.string(),
    backToWorks: z.string(),
    allWorks: z.string(),
    faqHeading: z.string(),
    beforeLabel: z.string(),
    afterLabel: z.string(),
    dragHint: z.string(),
    closeLabel: z.string(),
    prevLabel: z.string(),
    nextLabel: z.string(),
    scrollHint: z.string(),
    fromPrice: z.string(),
    perCar: z.string(),
    emptyWorks: z.string(),
  })
  .strict();

const channelsSchema = z
  .object({
    call: z.string(),
    whatsapp: z.string(),
    viber: z.string(),
    telegram: z.string(),
    instagram: z.string(),
  })
  .strict();

const formSchema = z
  .object({
    heading: z.string(),
    subheading: z.string(),
    nameLabel: z.string(),
    namePlaceholder: z.string(),
    contactChannelLabel: z.string(),
    channelPhone: z.string(),
    countryLabel: z.string(),
    contactLabel: z.string(),
    contactPlaceholder: z.string(),
    serviceLabel: z.string(),
    servicePlaceholder: z.string(),
    commentLabel: z.string(),
    commentPlaceholder: z.string(),
    submit: z.string(),
    submitting: z.string(),
    privacyNote: z.string(),
    privacyLinkText: z.string(),
    requiredError: z.string(),
    errorTelegram: z.string(),
    errorPhone: z.string(),
    errorConsent: z.string(),
    modalTitle: z.string(),
    noscriptNote: z.string(),
  })
  .strict();

const cookieSchema = z
  .object({
    notice: z.string(),
    more: z.string(),
    policyLink: z.string(),
    accept: z.string(),
    decline: z.string(),
    settings: z.string(),
  })
  .strict();

export const siteContentSchema = z
  .object({
    nav: navSchema,
    header: headerSchema,
    footer: footerSchema,
    common: commonSchema,
    channels: channelsSchema,
    form: formSchema,
    cookie: cookieSchema,
  })
  .strict();

export type SiteContent = z.infer<typeof siteContentSchema>;
