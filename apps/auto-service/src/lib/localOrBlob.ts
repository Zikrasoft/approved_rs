import { fromLocalFiles } from '@podbor/lead-crm';

export function localOrBlob<T>(
  blob: () => T,
  local: Parameters<typeof fromLocalFiles<T>>[0],
  defer: (opened: Promise<T>) => T,
): T {
  if (import.meta.env.DEV) return defer(fromLocalFiles(local));
  return blob();
}
