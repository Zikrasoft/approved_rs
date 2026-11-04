import { BotError, GrammyError } from 'grammy';

function loggedError(error: unknown): Record<string, unknown> {
  if (error instanceof BotError) return loggedError(error.error);
  if (error instanceof GrammyError)
    return {
      method: error.method,
      error_code: error.error_code,
      description: error.description,
    };
  if (error instanceof Error)
    return { name: error.name, message: error.message };
  return { type: typeof error };
}

export function logError(
  message: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  console.error(message, { ...context, error: loggedError(error) });
}
