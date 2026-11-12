import { importedSoFar, importRunning } from '../import-run';

describe('importRunning', () => {
  it('is true while any supplier has a running import', () => {
    expect(
      importRunning([
        { latest_import: null },
        { latest_import: { status: 'succeeded' } },
        { latest_import: { status: 'running' } },
      ]),
    ).toBe(true);
  });

  it('is false once every import has finished or none exists', () => {
    expect(
      importRunning([
        { latest_import: null },
        { latest_import: { status: 'succeeded' } },
        { latest_import: { status: 'failed' } },
      ]),
    ).toBe(false);
    expect(importRunning([])).toBe(false);
  });
});

describe('importedSoFar', () => {
  it('counts the imported and created articles of the progress report', () => {
    expect(importedSoFar({ imported: 7, created: 3 })).toBe(10);
  });

  it('is zero before the first page is reported', () => {
    expect(importedSoFar(null)).toBe(0);
  });
});
