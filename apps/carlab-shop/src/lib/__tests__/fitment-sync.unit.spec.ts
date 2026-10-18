import { decideFitmentSyncAction } from '../fitment-sync';

const NO_CRITERIA = { steering: null, gearbox: null } as const;

describe('decideFitmentSyncAction', () => {
  it('creates a row for a position with no existing Fitment', () => {
    expect(decideFitmentSyncAction([], 'stub', NO_CRITERIA)).toEqual({
      type: 'create',
    });
  });

  it('skips a manual row regardless of its status', () => {
    const existing = [
      {
        id: 'fitment_1',
        source: 'manual',
        status: 'active' as const,
        steering: null,
        gearbox: null,
      },
    ];

    expect(decideFitmentSyncAction(existing, 'stub', NO_CRITERIA)).toEqual({
      type: 'skip',
    });
  });

  it('skips a manual row even when it is rejected', () => {
    const existing = [
      {
        id: 'fitment_1',
        source: 'manual',
        status: 'rejected' as const,
        steering: null,
        gearbox: null,
      },
    ];

    expect(decideFitmentSyncAction(existing, 'stub', NO_CRITERIA)).toEqual({
      type: 'skip',
    });
  });

  it('never recreates its own row that staff rejected', () => {
    const existing = [
      {
        id: 'fitment_1',
        source: 'auto:stub',
        status: 'rejected' as const,
        steering: null,
        gearbox: null,
      },
    ];

    expect(decideFitmentSyncAction(existing, 'stub', NO_CRITERIA)).toEqual({
      type: 'skip',
    });
  });

  it('updates its own active row in place', () => {
    const existing = [
      {
        id: 'fitment_1',
        source: 'auto:stub',
        status: 'active' as const,
        steering: null,
        gearbox: null,
      },
    ];

    expect(decideFitmentSyncAction(existing, 'stub', NO_CRITERIA)).toEqual({
      type: 'update',
      id: 'fitment_1',
    });
  });

  it('creates a row when the position is held only by a different vendor', () => {
    const existing = [
      {
        id: 'fitment_1',
        source: 'auto:tecdoc',
        status: 'active' as const,
        steering: null,
        gearbox: null,
      },
    ];

    expect(decideFitmentSyncAction(existing, 'stub', NO_CRITERIA)).toEqual({
      type: 'create',
    });
  });

  it('creates a new row when its own vendor already covers this position with a different steering side', () => {
    const existing = [
      {
        id: 'fitment_1',
        source: 'auto:stub',
        status: 'active' as const,
        steering: 'left' as const,
        gearbox: null,
      },
    ];

    expect(
      decideFitmentSyncAction(existing, 'stub', {
        steering: 'right',
        gearbox: null,
      }),
    ).toEqual({ type: 'create' });
  });

  it('updates the own-vendor row matching the incoming steering side, leaving the other alone', () => {
    const existing = [
      {
        id: 'fitment_left',
        source: 'auto:stub',
        status: 'active' as const,
        steering: 'left' as const,
        gearbox: null,
      },
      {
        id: 'fitment_right',
        source: 'auto:stub',
        status: 'active' as const,
        steering: 'right' as const,
        gearbox: null,
      },
    ];

    expect(
      decideFitmentSyncAction(existing, 'stub', {
        steering: 'right',
        gearbox: null,
      }),
    ).toEqual({ type: 'update', id: 'fitment_right' });
  });
});
