export const DATABASE_POOL = {
  min: 2,
  max: 10,
  createTimeoutMillis: 5_000,
  propagateCreateError: false,
};

export const withoutJit = (databaseUrl: string): string => {
  const url = new URL(databaseUrl);
  url.searchParams.set('options', '-c jit=off');
  return url.toString();
};
