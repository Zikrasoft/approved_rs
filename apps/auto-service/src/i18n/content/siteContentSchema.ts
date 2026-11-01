import { z } from 'zod';
import { llmsHeadingsSchema } from '@podbor/i18n';

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
    nav: z
      .object({
        services: z.string(),
        parts: z.string(),
        works: z.string(),
        process: z.string(),
        about: z.string(),
        contact: z.string(),
      })
      .strict(),
    llms: llmsHeadingsSchema,
    header: z
      .object({
        menuOpenLabel: z.string(),
        menuCloseLabel: z.string(),
        languageLabel: z.string(),
        cta: z.string(),
        partsCta: z.string(),
        callback: z.string(),
      })
      .strict(),
    footer: z
      .object({
        tagline: z.string(),
        servicesHeading: z.string(),
        companyHeading: z.string(),
        contactHeading: z.string(),
        hours: z.string(),
        privacyLabel: z.string(),
        aboutLabel: z.string(),
        rightsSuffix: z.string(),
        developerCredit: z.string(),
      })
      .strict(),
    common: z
      .object({
        homeLabel: z.string(),
        skipToContent: z.string(),
        breadcrumbLabel: z.string(),
        primaryNavLabel: z.string(),
        mobileNavLabel: z.string(),
        faqHeading: z.string(),
        closeLabel: z.string(),
        fromPrice: z.string(),
        priceOnRequest: z.string(),
        allServices: z.string(),
        allWorks: z.string(),
        emptyWorks: z.string(),
        socialHeading: z.string(),
        writeInstead: z.string(),
      })
      .strict(),
    hours: z.object({ week: z.string(), saturday: z.string() }).strict(),
    visit: z
      .object({
        heading: z.string(),
        route: z.string(),
        facts: z.array(z.string()),
      })
      .strict(),
    channels: z
      .object({
        call: z.string(),
        whatsapp: z.string(),
        viber: z.string(),
        telegram: z.string(),
      })
      .strict(),
    telegramChoice: z
      .object({
        heading: z.string(),
        bot: z.string(),
        botHint: z.string(),
        manager: z.string(),
        managerHint: z.string(),
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
        telegramPlaceholder: z.string(),
        contactChannelLabel: z.string(),
        channelPhone: z.string(),
        countryLabel: z.string(),
        commentLabel: z.string(),
        commentPlaceholder: z.string(),
        submit: z.string(),
        submitting: z.string(),
        privacyNote: z.string(),
        privacyLinkText: z.string(),
        privacyOpen: z.string(),
        privacyNotice: z.string(),
        moreDetails: z.string(),
        modalTitle: z.string(),
        errorPhone: z.string(),
        errorPhoneTooLong: z.string(),
        errorTelegram: z.string(),
        errorTelegramHandle: z.string(),
        // TODO: drop once the translate job has pruned errorConsent from the translations.
        errorConsent: z.string().optional(),
        errorSubmit: z.string(),
      })
      .strict(),
    cookie: cookieSchema,
  })
  .strict();

export type SiteContent = z.infer<typeof siteContentSchema>;
