import { LOCAL_DATA_DIR } from './types.ts';

type FileStorageModule = typeof import('./file.ts');

let loaded: Promise<FileStorageModule> | undefined;

export function fromLocalFiles<T>(
  open: (file: FileStorageModule, dir: string) => T,
): Promise<T> {
  loaded ??= import('./file.ts');
  return loaded.then((file) => open(file, LOCAL_DATA_DIR));
}
