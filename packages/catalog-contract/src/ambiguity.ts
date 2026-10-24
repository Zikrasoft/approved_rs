import type { Fitment } from './fitment.ts';
import type { VinFacts } from './vehicle.ts';

type Candidate = Pick<Fitment, 'part_id' | 'axle' | 'side' | 'steering'> & {
  note: string | null;
  category_id: string | null;
};

export type PositionGroup<Row> = {
  category_id: string | null;
  axle: Fitment['axle'] | null;
  side: Fitment['side'] | null;
  ambiguous: boolean;
  fitments: Row[];
};

const fitsFacts = ({ steering }: Candidate, facts: VinFacts) =>
  !steering || !facts.steering || steering === facts.steering;

export function positionGroups<Row extends Candidate>(
  rows: Row[],
  facts: VinFacts,
): PositionGroup<Row>[] {
  const groups = new Map<string, PositionGroup<Row>>();
  for (const row of rows.filter((candidate) => fitsFacts(candidate, facts))) {
    const key = JSON.stringify([row.category_id, row.axle, row.side]);
    const group = groups.get(key) ?? {
      category_id: row.category_id,
      axle: row.axle,
      side: row.side,
      ambiguous: false,
      fitments: [],
    };
    group.fitments.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    ambiguous:
      new Set(group.fitments.map(({ part_id }) => part_id)).size > 1 ||
      group.fitments.some(({ note }) => Boolean(note)),
  }));
}
