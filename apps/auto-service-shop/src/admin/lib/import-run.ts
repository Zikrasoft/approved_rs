export const importRunning = (
  suppliers: { latest_import: { status: string } | null }[],
) => suppliers.some(({ latest_import }) => latest_import?.status === 'running');

export const importedSoFar = (
  report: { imported: number; created: number } | null,
) => (report ? report.imported + report.created : 0);
