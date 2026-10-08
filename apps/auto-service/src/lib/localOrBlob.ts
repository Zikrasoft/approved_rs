import { LOCAL_DATA_DIR } from '@podbor/lead-crm';

type FileStorageModule = typeof import('@podbor/lead-crm/storage/file');
type AsyncMethod = (...args: unknown[]) => Promise<unknown>;

export function localOrBlob<T extends object>(
  methods: readonly (keyof T & string)[],
  blob: () => T,
  local: (file: FileStorageModule, dir: string) => T,
): T {
  if (import.meta.env.DEV) {
    const opened = import('@podbor/lead-crm/storage/file').then((file) =>
      local(file, LOCAL_DATA_DIR),
    );
    return Object.fromEntries(
      methods.map((method) => [
        method,
        async (...args: unknown[]) =>
          ((await opened)[method] as AsyncMethod)(...args),
      ]),
    ) as T;
  }
  return blob();
}
