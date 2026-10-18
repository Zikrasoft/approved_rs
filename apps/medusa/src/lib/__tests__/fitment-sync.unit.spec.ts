import { decideFitmentSyncAction } from '../fitment-sync';

describe('decideFitmentSyncAction', () => {
  it('creates a row for a position with no existing Fitment', () => {
    expect(decideFitmentSyncAction([], 'stub')).toEqual({ type: 'create' });
  });

  it('skips a manual row regardless of its status', () => {
    const existing = [
      { id: 'fitment_1', source: 'manual', status: 'active' as const },
    ];

    expect(decideFitmentSyncAction(existing, 'stub')).toEqual({
      type: 'skip',
    });
  });

  it('skips a manual row even when it is rejected', () => {
    const existing = [
      { id: 'fitment_1', source: 'manual', status: 'rejected' as const },
    ];

    expect(decideFitmentSyncAction(existing, 'stub')).toEqual({
      type: 'skip',
    });
  });

  it('never recreates its own row that staff rejected', () => {
    const existing = [
      { id: 'fitment_1', source: 'auto:stub', status: 'rejected' as const },
    ];

    expect(decideFitmentSyncAction(existing, 'stub')).toEqual({
      type: 'skip',
    });
  });

  it('updates its own active row in place', () => {
    const existing = [
      { id: 'fitment_1', source: 'auto:stub', status: 'active' as const },
    ];

    expect(decideFitmentSyncAction(existing, 'stub')).toEqual({
      type: 'update',
      id: 'fitment_1',
    });
  });

  it('creates a row when the position is held only by a different vendor', () => {
    const existing = [
      { id: 'fitment_1', source: 'auto:tecdoc', status: 'active' as const },
    ];

    expect(decideFitmentSyncAction(existing, 'stub')).toEqual({
      type: 'create',
    });
  });
});
