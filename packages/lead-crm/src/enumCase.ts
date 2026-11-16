export const upper = <T extends string>(value: T) =>
  value.toUpperCase() as Uppercase<T>;

export const lower = <T extends string>(value: T) =>
  value.toLowerCase() as Lowercase<T>;
