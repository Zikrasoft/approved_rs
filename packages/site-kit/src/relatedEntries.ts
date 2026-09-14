interface Taggable {
  id: string;
  data: { servicesApplied: readonly string[] };
}

// "Related" used to mean "the three newest", which pointed a brake job at two
// gearbox jobs and left most cases with a single inbound link. Entries sharing
// a service come first; the newest fill any remaining slot, so a freshly added
// entry is never left with an empty row.
export function relatedEntries<T extends Taggable>(
  all: T[],
  current: T,
  limit = 3,
): T[] {
  const services = new Set(current.data.servicesApplied);
  const others = all.filter((entry) => entry.id !== current.id);
  const shared = others.filter((entry) =>
    entry.data.servicesApplied.some((slug) => services.has(slug)),
  );
  const rest = others.filter((entry) => !shared.includes(entry));
  return [...shared, ...rest].slice(0, limit);
}
