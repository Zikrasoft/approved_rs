import { describe, it, expect } from 'vitest';
import { relatedEntries } from './relatedEntries.ts';

const entry = (id: string, ...servicesApplied: string[]) => ({
  id,
  data: { servicesApplied },
});

const brakes = entry('brakes', 'brakes-suspension');
const discs = entry('discs', 'brakes-suspension', 'servicing');
const gearbox = entry('dsg', 'engine-gearbox');
const oil = entry('oil', 'servicing');

describe('relatedEntries', () => {
  it('puts entries sharing a service first', () => {
    expect(relatedEntries([brakes, gearbox, discs, oil], brakes)[0]!.id).toBe(
      'discs',
    );
  });

  it('never returns the entry itself', () => {
    expect(
      relatedEntries([brakes, gearbox, discs, oil], brakes).map((e) => e.id),
    ).not.toContain('brakes');
  });

  it('fills the remaining slots with the rest, newest-first as given', () => {
    expect(
      relatedEntries([brakes, gearbox, discs, oil], brakes).map((e) => e.id),
    ).toEqual(['discs', 'dsg', 'oil']);
  });

  it('falls back to the rest when nothing shares a service', () => {
    const orphan = entry('body', 'bodywork-painting');
    expect(
      relatedEntries([orphan, gearbox, oil], orphan).map((e) => e.id),
    ).toEqual(['dsg', 'oil']);
  });

  it('treats an entry with no services as sharing nothing', () => {
    const bare = entry('bare');
    expect(relatedEntries([bare, brakes, oil], bare).map((e) => e.id)).toEqual([
      'brakes',
      'oil',
    ]);
  });

  it('honours the limit', () => {
    expect(
      relatedEntries([brakes, gearbox, discs, oil], brakes, 1),
    ).toHaveLength(1);
  });

  it('returns nothing when there is only one entry', () => {
    expect(relatedEntries([brakes], brakes)).toEqual([]);
  });
});
