export const importRunning = (
  suppliers: { latest_import: { status: string } | null }[],
) => suppliers.some(({ latest_import }) => latest_import?.status === 'running');

export const importedSoFar = (
  report: { created: number; updated: number; unchanged: number } | null,
) => (report ? report.created + report.updated + report.unchanged : 0);
