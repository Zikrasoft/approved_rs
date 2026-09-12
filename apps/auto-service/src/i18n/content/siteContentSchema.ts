import { z } from 'zod';

export const siteContentSchema = z
  .object({
    nav: z
      .object({
        services: z.string(),
        shop: z.string(),
        works: z.string(),
        process: z.string(),
        about: z.string(),
        contact: z.string(),
      })
      .strict(),
    header: z
      .object({
        menuOpenLabel: z.string(),
        menuCloseLabel: z.string(),
        languageLabel: z.string(),
        cta: z.string(),
        phoneLabel: z.string(),
      })
      .strict(),
    footer: z
      .object({
        tagline: z.string(),
        servicesHeading: z.string(),
        companyHeading: z.string(),
        contactHeading: z.string(),
        hoursHeading: z.string(),
        hours: z.string(),
        privacyLabel: z.string(),
        rightsSuffix: z.string(),
      })
      .strict(),
    common: z
      .object({
        homeLabel: z.string(),
        skipToContent: z.string(),
        breadcrumbLabel: z.string(),
        primaryNavLabel: z.string(),
        mobileNavLabel: z.string(),
        readMore: z.string(),
        faqHeading: z.string(),
        closeLabel: z.string(),
        fromPrice: z.string(),
        priceOnRequest: z.string(),
        allServices: z.string(),
        backToShop: z.string(),
        allWorks: z.string(),
        emptyWorks: z.string(),
      })
      .strict(),
    channels: z
      .object({
        call: z.string(),
        whatsapp: z.string(),
        viber: z.string(),
        telegram: z.string(),
        write: z.string(),
      })
      .strict(),
    form: z
      .object({
        heading: z.string(),
        subheading: z.string(),
        nameLabel: z.string(),
        namePlaceholder: z.string(),
        contactLabel: z.string(),
        contactPlaceholder: z.string(),
        serviceLabel: z.string(),
        servicePlaceholder: z.string(),
        carLabel: z.string(),
        carPlaceholder: z.string(),
        commentLabel: z.string(),
        commentPlaceholder: z.string(),
        submit: z.string(),
        submitting: z.string(),
        privacyNote: z.string(),
        privacyLinkText: z.string(),
        modalTitle: z.string(),
      })
      .strict(),
  })
  .strict();

export type SiteContent = z.infer<typeof siteContentSchema>;
