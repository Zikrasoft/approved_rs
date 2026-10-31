import type {
  ILockingModule,
  MedusaContainer,
} from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

const LOCK_TIMEOUT_SECONDS = 30;

export type Lock = <T>(key: string, job: () => Promise<T>) => Promise<T>;

export const lockOf =
  (scope: MedusaContainer): Lock =>
  (key, job) =>
    scope
      .resolve<ILockingModule>(Modules.LOCKING)
      .execute(key, job, { timeout: LOCK_TIMEOUT_SECONDS });

export const lockedBy =
  (lock: Lock, prefix: string) =>
  <A extends unknown[], T>(job: (id: string, ...args: A) => Promise<T>) =>
  (id: string, ...args: A): Promise<T> =>
    lock(`${prefix}:${id}`, () => job(id, ...args));
