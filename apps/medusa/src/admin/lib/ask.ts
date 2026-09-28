export async function ask(path: string, init?: RequestInit) {
  const response = await fetch(path, { credentials: 'include', ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? 'Сервер не ответил. Попробуйте ещё раз.');
  }
  return body;
}
