import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { PARTS_INQUIRY_OPEN_ATTRIBUTE } from '@/scripts/partsList';
import InquiryLink from './InquiryLink.astro';
import { render, setShop } from './renderAstro';

const copy = content('ru').partsSearch;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('InquiryLink', () => {
  it('offers a pick card with no price wording while the shop is closed', async () => {
    setShop(false);
    const block = await render(InquiryLink, { props: { class: 'mt-4' } });
    const cta = block.querySelector('a');

    expect(block.textContent).toContain(copy.pickHeading);
    expect(block.textContent).not.toContain(copy.notFoundQuestion);
    expect(cta?.textContent?.trim()).toBe(copy.pickCta);
    expect(cta?.getAttribute('href')).toBe('/ru/parts/#inquiry');
    expect(cta?.hasAttribute(PARTS_INQUIRY_OPEN_ATTRIBUTE)).toBe(false);
    expect(block.querySelector('.card.mt-4')).not.toBeNull();
  });

  it('asks whether the visitor found the part once the shop is open', async () => {
    setShop(true);
    const block = await render(InquiryLink);

    expect(block.textContent).toContain(copy.notFoundQuestion);
    expect(block.textContent).not.toContain(copy.pickHeading);
    expect(block.querySelector('a')?.textContent?.trim()).toBe(
      copy.notFoundLink,
    );
  });

  it.each([false, true])(
    'opens its own inquiry modal prefilled with the topic (shop open: %s)',
    async (open) => {
      setShop(open);
      const block = await render(InquiryLink, {
        props: { topic: 'Аккумуляторы' },
      });

      expect(
        block.querySelector('a')?.hasAttribute(PARTS_INQUIRY_OPEN_ATTRIBUTE),
      ).toBe(true);
      expect(block.querySelector('textarea')?.textContent).toBe(
        'Аккумуляторы: ',
      );
    },
  );
});
