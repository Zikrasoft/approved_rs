import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import { CALLBACK_HEADING_ATTRIBUTE } from '@/scripts/callbackHeading';
import FacetFilters from './FacetFilters.astro';
import LeadModal from './LeadModal.astro';
import PartsInquiryModal from './PartsInquiryModal.astro';
import ModalSheet from './ModalSheet.astro';
import SiteHeader from './SiteHeader.astro';
import TelegramChoice from './TelegramChoice.astro';
import { render } from './renderAstro';

const components = import.meta.glob<string>('./*.astro', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the modal sheet', () => {
  it('is the one place a modal form keeps its submit bar in view', () => {
    const shells = Object.entries(components)
      .filter(([, source]) => source.includes('[&_.lead-submit]'))
      .map(([path]) => path);
    expect(shells.sort()).toEqual(['./ModalSheet.astro']);
  });

  it.each([
    [
      'the modal sheet',
      () =>
        render(ModalSheet, {
          props: { trigger: '[data-x]', label: 'Заявка', heading: 'Заявка' },
        }),
    ],
    ['the header search', () => render(SiteHeader)],
    ['the Telegram choice', () => render(TelegramChoice)],
    [
      'the filter sheet',
      () =>
        render(FacetFilters, {
          path: '/ru/parts/search/',
          props: { action: '/ru/parts/search/', hidden: {}, facets: [] },
        }),
    ],
  ])('gives %s one labelled close button', async (_name, mount) => {
    const dialog = (await mount()).querySelector('dialog')!;
    const closers = dialog.querySelectorAll('button[data-modal-close]');

    expect(closers).toHaveLength(1);
    expect(closers[0].getAttribute('aria-label')).toBeTruthy();
  });
});

describe('the callback heading', () => {
  it('rides on the lead modal for a callback trigger to swap in', async () => {
    const host = (await render(LeadModal, { path: '/ru/' })).querySelector(
      'carlab-modal',
    )!;

    expect(host.getAttribute(CALLBACK_HEADING_ATTRIBUTE)).toBe(
      content('ru').site.form.callbackTitle,
    );
  });

  it('is left off a modal sheet that has no callback', async () => {
    const host = (await render(PartsInquiryModal)).querySelector(
      'carlab-modal',
    )!;

    expect(host.hasAttribute(CALLBACK_HEADING_ATTRIBUTE)).toBe(false);
  });
});
