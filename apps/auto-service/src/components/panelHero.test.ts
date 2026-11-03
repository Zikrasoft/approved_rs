import { describe, expect, it } from 'vitest';
import wide from '@/assets/workshop-bay.jpg';
import { panelPhoto } from '@/utils/panelPhoto';
import PanelHero from './PanelHero.astro';
import { render } from './renderAstro';

const hero = (props: Record<string, unknown> = {}, slots = {}) =>
  render(PanelHero, {
    path: '/ru/services/diagnostics/',
    props: {
      heading: 'Компьютерная диагностика в Белграде',
      crumbs: [{ href: '/ru/services/', label: 'Услуги' }],
      ...props,
    },
    slots,
  });
const grid = (root: Element) => root.querySelector('section > div')!;

describe('PanelHero', () => {
  it('puts the page name in the h1 on the graphite panel', async () => {
    const root = await hero();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe(
      'Компьютерная диагностика в Белграде',
    );
    expect(grid(root).classList.contains('bg-panel')).toBe(true);
  });

  it('shows the hook on every screen and the longer lead only on a wide one', async () => {
    const [hook, lead] = [
      ...(
        await hero({ hook: 'Код ошибки это симптом.', lead: 'Сканер скажет.' })
      ).querySelectorAll('h1 ~ p'),
    ];

    expect(hook.textContent?.trim()).toBe('Код ошибки это симптом.');
    expect(hook.classList.contains('max-lg:hidden')).toBe(false);
    expect(lead.textContent?.trim()).toBe('Сканер скажет.');
    expect(lead.classList.contains('max-lg:hidden')).toBe(true);
  });

  it('stays one column with no photo and splits beside a real one', async () => {
    const photo = await panelPhoto({ image: wide, alt: 'Цех CarLab' });
    const withPhoto = await hero({ photo });
    const image = withPhoto.querySelector('img')!;

    expect((await hero()).querySelector('img')).toBeNull();
    expect(grid(await hero()).className).not.toContain('lg:grid-cols');
    expect(grid(withPhoto).className).toContain('lg:grid-cols');
    expect(grid(withPhoto).classList.contains('lg:min-h-[28rem]')).toBe(true);
    expect(grid(await hero()).className).not.toContain('lg:min-h');
    expect(
      withPhoto.querySelector('h1')!.closest('.lg\\:justify-center'),
    ).not.toBeNull();
    expect(image.getAttribute('fetchpriority')).toBe('high');
    expect(image.getAttribute('sizes')).toBe(photo.sizes);
    expect(image.getAttribute('srcset')).toBe(photo.srcset);
    expect(image.getAttribute('alt')).toBe('Цех CarLab');
  });

  it('lets the photo fill the right column edge to edge, clipped by the panel rounding', async () => {
    const photo = await panelPhoto({ image: wide, alt: 'Цех CarLab' });
    const panel = grid(await hero({ photo }));
    const picture = panel.querySelector(':scope > picture')!;

    expect([...panel.classList]).toEqual(
      expect.arrayContaining(['overflow-hidden', 'rounded-block']),
    );
    expect(picture.classList.contains('lg:col-start-2')).toBe(true);
    expect(picture.querySelector('img')!.classList.contains('lg:h-full')).toBe(
      true,
    );
  });

  it('renders the page facts and actions under the heading', async () => {
    const root = await hero({}, { default: '<dl id="facts"></dl>' });

    expect(root.querySelector('h1 ~ #facts, div > #facts')).not.toBeNull();
  });
});
