import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import GarageAddress from './GarageAddress.astro';
import { render } from './renderAstro';

const site = content('ru').site;
const address = (props: Record<string, unknown>) =>
  render(GarageAddress, { path: '/ru/', props });
const mapLink = (root: Element) => root.querySelector('a')!;

describe('GarageAddress', () => {
  it('opens the garage on the map in a new tab', async () => {
    const link = mapLink(await address({ tone: 'card', layout: 'block' }));

    expect(link.getAttribute('href')).toBe(
      'https://maps.google.com/?cid=4988774890072933706',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
  });

  it('sets the one-line form beside the hero heading', async () => {
    const root = await address({
      tone: 'panel',
      layout: 'line',
      class: 'text-sm',
    });
    const line = root.querySelector('p')!;

    expect(mapLink(root).textContent).toBe('Jovana Ćirilova 23a, Zvezdara');
    expect(line.classList.contains('text-sm')).toBe(true);
    expect(line.querySelector('span')?.textContent).toBe(site.footer.hours);
    expect(
      line.querySelector('span')?.classList.contains('text-panel-ink'),
    ).toBe(true);
  });

  it('stacks the street, district and both hours lines in the block form', async () => {
    const root = await address({ tone: 'card', layout: 'block' });

    expect(mapLink(root).textContent).toContain('Jovana Ćirilova 23a');
    expect(mapLink(root).textContent).toContain('Zvezdara, Beograd');
    expect(root.querySelector('p')?.textContent).toContain(site.hours.week);
    expect(root.querySelector('p')?.textContent).toContain(site.hours.saturday);
    expect(root.querySelector('.text-muted')).not.toBeNull();
    expect(root.querySelector('.text-panel-ink')).toBeNull();
  });
});
