// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { rememberVin } from '@podbor/site-kit/browser';
import { defineVinPrefill } from './vinPrefill';

defineVinPrefill();

const markup = `
  <vin-prefill data-template="VIN: {vin}">
    <a data-contact-channel="whatsapp" href="https://wa.me/381601111111?text=${encodeURIComponent('Knecht OX 371D: подойдет?')}"></a>
    <a data-contact-channel="telegram" href="https://t.me/bot?start=ru"></a>
  </vin-prefill>`;

const hrefs = () =>
  [...document.querySelectorAll('a')].map((link) => link.href);

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  history.replaceState(null, '', '/');
});

describe('<vin-prefill>', () => {
  it('adds the remembered VIN to the WhatsApp message only', () => {
    rememberVin('WBA35BG070N074158');
    document.body.innerHTML = markup;

    expect(hrefs()).toEqual([
      `https://wa.me/381601111111?text=${encodeURIComponent('Knecht OX 371D: подойдет?\nVIN: WBA35BG070N074158')}`,
      'https://t.me/bot?start=ru',
    ]);
  });

  it('prefers the VIN the page was opened with', () => {
    rememberVin('WBA35BG070N074158');
    history.replaceState(null, '', '/?vin=WDD2130041A123456');
    document.body.innerHTML = markup;

    expect(hrefs()[0]).toContain(encodeURIComponent('VIN: WDD2130041A123456'));
  });

  it('leaves the message alone without a VIN', () => {
    document.body.innerHTML = markup;

    expect(hrefs()[0]).toBe(
      `https://wa.me/381601111111?text=${encodeURIComponent('Knecht OX 371D: подойдет?')}`,
    );
  });
});
