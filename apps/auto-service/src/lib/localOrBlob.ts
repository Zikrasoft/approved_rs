import { LOCAL_DATA_DIR } from '@podbor/lead-crm';

type FileStorageModule = typeof import('@podbor/lead-crm/storage/file');

let fileStorage: Promise<FileStorageModule> | undefined;

export function localOrBlob<T>(
  blob: () => T,
  local: (file: FileStorageModule, dir: string) => T,
  defer: (opened: Promise<T>) => T,
): T {
  if (import.meta.env.DEV) {
    fileStorage ??= import('@podbor/lead-crm/storage/file');
    return defer(fileStorage.then((file) => local(file, LOCAL_DATA_DIR)));
  }
  return blob();
}
