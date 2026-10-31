// @vitest-environment jsdom
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { defineLeadModal } from './leadModal.ts';

beforeAll(() => {
  window.HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  };
});

let seq = 0;

const form = ({
  service = true,
  defaultService = 'brakes' as string | null,
} = {}) => `
  <form data-lead-form ${defaultService === null ? '' : `data-default-service="${defaultService}"`}>
    <button type="button" data-tab="telegram" data-panel="t"></button>
    <button type="button" data-tab="phone" data-panel="p"></button>
    <div data-panel="t"><input name="telegram" /></div>
    <div data-panel="p" hidden><input name="phone" /></div>
    ${service ? '<input type="hidden" name="service" value="brakes" />' : ''}
  </form>`;

const mount = (body: string, { page = false } = {}) => {
  const tag = `lead-modal-${(seq += 1)}`;
  document.body.innerHTML = `
    <button data-open-lead-modal>open</button>
    <button data-open-lead-modal="phone" data-lead-service="tires">call</button>
    <${tag} trigger="[data-open-lead-modal]" ${page ? 'data-page-lead-modal' : ''}>
      <dialog>${body}</dialog>
    </${tag}>`;
  return tag;
};

const open = (index: number) =>
  document.querySelectorAll<HTMLButtonElement>('body > button')[index].click();

const serviceValue = () =>
  document.querySelector<HTMLInputElement>('input[name="service"]')!.value;

beforeEach(() => {
  window.trackGoal = vi.fn();
});

afterEach(() => {
  delete (window as Partial<Window>).trackGoal;
  document.body.innerHTML = '';
});

describe('defineLeadModal', () => {
  it('opens on the tab and service the trigger names, and counts the opening', () => {
    const tag = mount(form());
    const panels = document.querySelectorAll<HTMLElement>('div[data-panel]');
    document
      .querySelector('[data-tab="phone"]')!
      .addEventListener('click', () => {
        panels[0].hidden = true;
        panels[1].hidden = false;
      });
    defineLeadModal(tag);
    open(1);
    expect(serviceValue()).toBe('tires');
    expect(document.activeElement?.getAttribute('name')).toBe('phone');
    expect(window.trackGoal).toHaveBeenCalledWith('lead_modal_open', {
      tab: 'phone',
      service: 'tires',
    });
  });

  it('resets the service to the form default when the trigger names none', () => {
    const tag = mount(form());
    defineLeadModal(tag);
    open(1);
    document.querySelector('dialog')!.open = false;
    open(0);
    expect(serviceValue()).toBe('brakes');
    expect(document.activeElement?.getAttribute('name')).toBe('telegram');
    expect(window.trackGoal).toHaveBeenLastCalledWith('lead_modal_open', {
      tab: 'default',
      service: 'brakes',
    });
  });

  it('keeps a service the form was built with when it names no default', () => {
    const tag = mount(form({ defaultService: null }));
    defineLeadModal(tag);
    open(0);
    expect(serviceValue()).toBe('brakes');
  });

  it('reports no service for a form that carries none', () => {
    const tag = mount(form({ service: false }));
    defineLeadModal(tag);
    open(0);
    expect(window.trackGoal).toHaveBeenCalledWith('lead_modal_open', {
      tab: 'default',
      service: 'none',
    });
  });

  it('leaves focus on the element the modal marks for it', () => {
    const tag = mount(`<h2 data-modal-focus tabindex="-1">Hi</h2>${form()}`);
    defineLeadModal(tag);
    open(0);
    expect(document.activeElement?.tagName).toBe('H2');
  });

  it('counts nothing for a modal without a lead form', () => {
    const tag = mount('<p>filters</p>');
    defineLeadModal(tag);
    open(0);
    expect(window.trackGoal).not.toHaveBeenCalled();
    expect(document.querySelector('dialog')!.open).toBe(true);
  });

  it('lets the page modal alone answer when a page renders its own', () => {
    const tag = mount(form(), { page: true });
    document.body.insertAdjacentHTML(
      'beforeend',
      `<${tag} trigger="[data-open-lead-modal]" id="header"><dialog></dialog></${tag}>`,
    );
    defineLeadModal(tag);
    expect(document.getElementById('header')!.hasAttribute('trigger')).toBe(
      false,
    );
    expect(
      document.querySelector('[data-page-lead-modal]')!.hasAttribute('trigger'),
    ).toBe(true);
  });

  it('ignores modal openings of other elements and arms once per tag', () => {
    const tag = mount(form());
    defineLeadModal(tag);
    defineLeadModal(tag);
    document.body.dispatchEvent(
      new CustomEvent('modal:open', { bubbles: true, detail: {} }),
    );
    expect(window.trackGoal).not.toHaveBeenCalled();
    open(0);
    expect(window.trackGoal).toHaveBeenCalledTimes(1);
  });
});
