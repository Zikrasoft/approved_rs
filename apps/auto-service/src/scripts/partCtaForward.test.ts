// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { definePartCtaForward } from './partCtaForward';

definePartCtaForward();

const render = (to: string | null, targetHidden = false) => {
  document.body.innerHTML = `
    <section id="offers">
      <button data-buy ${targetHidden ? 'hidden' : ''}>buy</button>
    </section>
    <part-cta-forward ${to === null ? '' : `data-to="${to}"`}>
      <a href="#offers">Buy</a>
    </part-cta-forward>`;
  const target = document.querySelector<HTMLElement>('[data-buy]')!;
  const scroll = vi.fn();
  target.scrollIntoView = scroll;
  const bought = vi.fn();
  target.addEventListener('click', bought);
  const link = document.querySelector<HTMLAnchorElement>('a')!;
  const click = () => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    return event;
  };
  return { click, scroll, bought };
};

describe('<part-cta-forward>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('presses the offer the sticky bar points at instead of following the link', () => {
    const { click, scroll, bought } = render('#offers [data-buy]');
    expect(click().defaultPrevented).toBe(true);
    expect(scroll).toHaveBeenCalledWith({ block: 'center' });
    expect(bought).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the target is hidden', '#offers [data-buy]', true],
    ['nothing matches', '#offers [data-missing]', false],
    ['no target is named', null, false],
  ])('follows the link when %s', (_, to, hidden) => {
    const { click, bought } = render(to, hidden);
    expect(click().defaultPrevented).toBe(false);
    expect(bought).not.toHaveBeenCalled();
  });

  it('presses once after a reconnect, and lets go when removed', () => {
    const { click, bought } = render('#offers [data-buy]');
    const forward = document.querySelector('part-cta-forward')!;
    (forward as unknown as { connectedCallback(): void }).connectedCallback();
    click();
    expect(bought).toHaveBeenCalledTimes(1);
    forward.remove();
    forward.querySelector('a')!.click();
    expect(bought).toHaveBeenCalledTimes(1);
  });

  it('defines the element only once', () => {
    const first = customElements.get('part-cta-forward');
    definePartCtaForward();
    expect(customElements.get('part-cta-forward')).toBe(first);
  });
});
