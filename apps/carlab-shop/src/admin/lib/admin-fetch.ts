import { toast } from '@medusajs/ui';
import { z } from 'zod';

const errorBodySchema = z.object({ message: z.string().min(1) });

const errorMessage = async (response: Response): Promise<string> => {
  const body = errorBodySchema.safeParse(
    await response.json().catch(() => null),
  );
  return body.success
    ? body.data.message
    : `${response.status} ${response.statusText}`;
};

export type ErrorMessages = Record<string, string>;

export const adminFetch = async <T>(
  path: string,
  init?: RequestInit,
  messages: ErrorMessages = {},
): Promise<T | null> => {
  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!response.ok) {
      const message = await errorMessage(response);
      toast.error(
        Object.entries(messages).find(([fragment]) =>
          message.includes(fragment),
        )?.[1] ?? message,
      );
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
    return null;
  }
};
