import { describe, expect, it } from 'vitest';
import consentField from './ConsentField.astro?raw';

describe('the consent line', () => {
  it('keeps a space between the note and the privacy link', () => {
    expect(consentField).toMatch(
      /\{site\.form\.privacyNote\}\{' '\}<a\s+href=\{PathBuilder\.privacy\(locale\)\}/,
    );
  });
});
