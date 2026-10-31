export const literalLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');
