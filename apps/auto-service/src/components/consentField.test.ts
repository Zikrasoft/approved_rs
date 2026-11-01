import { describe, expect, it } from 'vitest';
import consentField from './ConsentField.astro?raw';

const labelEnd = consentField.indexOf('</label>');
const label = consentField.slice(consentField.indexOf('<label'), labelEnd);

describe('the consent line', () => {
  it('keeps the whole sentence as label text, so a tap on it ticks the box', () => {
    expect(label).not.toContain('<a');
    expect(label).toContain(
      '{`${site.form.privacyNote} ${site.form.privacyLinkText}.`}',
    );
  });

  it('puts the privacy link after the label as its own tap target', () => {
    expect(consentField.slice(labelEnd)).toMatch(
      /<a\s+href=\{PathBuilder\.privacy\(locale\)\}[^>]*min-h-11/,
    );
  });
});
